// ── App Types ────────────────────────────────────────────────
// Core type definitions for the Meridian frontend: domain entities, API response shapes,
// UI state types, and data transfer interfaces used across components and services.
//
// This file has two distinct halves:
//  1. "Domain Types" through "Agent Feed & Channel Connect Types" — UI-shaped view models
//     (pre-formatted strings, colors, onClick handlers) produced by the mock data generators
//     in constants/app.ts and consumed by pages/components for screens that aren't wired to
//     real endpoints yet (financials charts, team/roles, guides, messages, etc.).
//  2. "API Response Types" (below) — the *actual* JSON shapes returned by the Laravel backend,
//     used by src/services/api-service.ts and by the handful of pages/contexts that fetch
//     real data (Trips, TripDetail, Travelers, Settings, Dashboard, AppContext). These should
//     be kept in sync with the corresponding Eloquent model + controller on the backend.

export type Screen = 'dashboard' | 'trips' | 'tripDetail' | 'messages' | 'travelers' | 'financials' | 'pricing' | 'settings' | 'help' | 'guide';

// Union of every status label the UI can show for a trip. Mixes two vocabularies:
// the original mock-data labels ('Draft', 'AI drafting', 'Awaiting review', ...) and the
// real backend TripStatus enum values re-labeled for display ('Inquiry', 'In Progress',
// 'Cancelled' — see apiStatusMeta in constants/app.ts, which maps backend TripStatus values
// like `planning`/`in_progress` to these display strings).
export type TripStatusLabel = 'Draft' | 'AI drafting' | 'Awaiting review' | 'Shared' | 'Changes requested' | 'Confirmed' | 'Booked' | 'Completed' | 'Inquiry' | 'In Progress' | 'Cancelled';

// Real backend status enums — must be kept in sync with App\Enums\TripStatus and
// App\Enums\ItineraryStatus on Meridian-Backend. Unlike TripStatusLabel above (a display
// string), these are the literal values stored in the database and sent/received over the API.
export const TripStatus = {
  INQUIRY: 'inquiry',
  PLANNING: 'planning',
  BOOKED: 'booked',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
} as const;
export type TripStatus = typeof TripStatus[keyof typeof TripStatus];

export const ItineraryStatus = {
  DRAFT: 'draft',
  PLANNING: 'planning',
  CONFIRMED: 'confirmed',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
} as const;
export type ItineraryStatus = typeof ItineraryStatus[keyof typeof ItineraryStatus];

// Mirrors App\Enums\FlightStatus / App\Enums\AccommodationStatus on the backend (both share
// the same pending -> booked -> confirmed lifecycle, or cancelled at any point).
export const FlightStatus = {
  PENDING: 'pending',
  BOOKED: 'booked',
  CONFIRMED: 'confirmed',
  CANCELLED: 'cancelled',
} as const;
export type FlightStatus = typeof FlightStatus[keyof typeof FlightStatus];

export const AccommodationStatus = {
  PENDING: 'pending',
  BOOKED: 'booked',
  CONFIRMED: 'confirmed',
  CANCELLED: 'cancelled',
} as const;
export type AccommodationStatus = typeof AccommodationStatus[keyof typeof AccommodationStatus];

// Mirrors App\Enums\TransactionStatus.
export const TransactionStatus = {
  PENDING: 'pending',
  COMPLETED: 'completed',
  FAILED: 'failed',
  REFUNDED: 'refunded',
} as const;
export type TransactionStatus = typeof TransactionStatus[keyof typeof TransactionStatus];

// Mirrors App\Enums\CallActionItemStatus.
export const CallActionItemStatus = {
  PENDING: 'pending',
  CHECKED: 'checked',
  ARCHIVED: 'archived',
} as const;
export type CallActionItemStatus = typeof CallActionItemStatus[keyof typeof CallActionItemStatus];

export type BuilderTab = 'itinerary' | 'flights' | 'stays' | 'activities' | 'events' | 'calls';

export type BillingPeriod = 'monthly' | 'annual';

export type ChannelType = 'whatsapp' | 'gmail' | 'instagram';

export type SettingsTab = 'profile' | 'workspace' | 'team' | 'roles' | 'channels' | 'notifications' | 'ai' | 'payments';

export type ConnectStep = 'pick' | 'auth' | 'sync' | 'done';

export type RoleType = 'Super admin' | 'Agent' | 'Finance' | 'Read-only';

// ── Domain Types ──
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
  entityId?: string;
  entityType?: 'flight' | 'stay' | 'destination';
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
  // Present only for real (non-mock) itinerary options — the itinerary_id to delete via
  // ApiService.deleteItinerary(). Absent for mock options, which can't be deleted.
  itineraryId?: string;
}

export interface TripItem {
  id?: string;
  name: string;
  traveler: string;
  initials: string;
  avatarBg: string;
  where: string;
  dates: string;
  status: TripStatusLabel;
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
  status: TripStatusLabel;
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
  showOptions: boolean;
}

// ── Trip & Itinerary Types ──
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
  booking_url?: string | null;
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
  booking_url?: string | null;
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

// ── Conversation Types ──
export interface Conversation {
  // Only present when reshaped from real data (AppContext.fetchConversationsList()) — used to
  // route to /app/messages/:conversationId and to fetch the full thread/link a trip.
  conversation_id?: string;
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

// ── Financial Types ──
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

// ── Plan, Traveler, Team Types ──
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

export interface NotifSetting {
  key: string;
  title: string;
  desc: string;
  on: boolean;
  trackBg: string;
  knobX: string;
  toggle: () => void;
}

// ── Guides & Onboarding Types ──
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

// ── Agent Feed & Channel Connect Types ──
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

// ── API Response Types ──
// Mirrors Laravel's default paginate() JSON shape (LengthAwarePaginator::toArray()).
// Every list-fetching ApiService method (getCustomers, getTrips, getTransactions, ...)
// returns one of these.
export interface ApiPaginatedResponse<T> {
  data: T[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

export interface CustomerResponse {
  customer_id: string;
  company_id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  nationality: string | null;
  date_of_birth: string | null;
  passport_number: string | null;
  notes: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  company?: { company_id: string; company_name: string };
  trips?: { trip_id: string; trip_name: string }[];
}

export interface TransactionResponse {
  transaction_id: string;
  amount: number;
  currency: string;
  status: TransactionStatus;
  payment_method: string | null;
  transaction_reference: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
  client_name: string | null;
  subscription_payment?: {
    transaction_id: string;
    subscription_id: string;
    company_id: string;
    initiated_by: string | null;
  } | null;
  trip_payment?: {
    transaction_id: string;
    trip_id: string;
    notes: string | null;
    trip?: { trip_id: string; trip_name: string; company_id: string; customers?: { first_name: string; last_name: string }[] };
  } | null;
  installment_payment?: {
    transaction_id: string;
    installment_id: string;
    notes: string | null;
  } | null;
}

// ── WeWire ── Multi-currency virtual accounts, up to 3 per company (one per currency), and
// the trip installment plans/public collection page built on top of them. WeWire has no
// hosted checkout link product — see WeWireLookupResponse instead.

export type VirtualAccountStatus = 'requested' | 'pending' | 'active' | 'denied' | 'suspended' | 'closed';
export type FundHandling = 'hold' | 'disburse';
export type PaymentPlanStatus = 'draft' | 'active' | 'completed' | 'cancelled';
export type InstallmentStatus = 'pending' | 'partially_paid' | 'paid' | 'overdue';
export type WeWireKycStatus = 'not_started' | 'draft' | 'in_review' | 'approved' | 'rejected' | 'resubmission';
export type InboundMatchStatus = 'unmatched' | 'matched' | 'reconciled';
export type DisbursementStatus = 'pending' | 'successful' | 'failed' | 'reversed' | 'cancelled' | 'initiation_failed';

export const WEWIRE_SUPPORTED_CURRENCIES = ['USD', 'EUR', 'GBP', 'GHS'] as const;
export const WEWIRE_MAX_ACCOUNTS = 3;

export type BeneficiaryType = 'agency' | 'provider';

// A payout account — either the agency's own (beneficiary_type='agency', the original/default
// kind) or a specific trip service provider's (beneficiary_type='provider' — an airline,
// hotel, or activity vendor). `label` is a free-text display name for provider beneficiaries
// (e.g. "Emirates Airlines"), since account_name is the legal bank-account holder name.
export interface WeWireBeneficiaryResponse {
  id: string;
  company_id: string;
  beneficiary_type: BeneficiaryType;
  label: string | null;
  wewire_beneficiary_id: string | null;
  currency: string;
  country: string | null;
  account_name: string;
  bank_name: string | null;
  address_line1: string | null;
  city: string | null;
  account_number: string | null;
  iban: string | null;
  sort_code: string | null;
  routing_number: string | null;
  account_category: 'CHECKING' | 'SAVINGS' | null;
  swift_bic: string | null;
  settlement_method: string | null;
  // True when created via the "Response from wewire server" fallback popup rather than a
  // genuine WeWire response — see WeWireBeneficiaryController::store.
  is_simulated: boolean;
  created_at: string;
  updated_at: string;
}

export interface VirtualAccountResponse {
  id: string;
  company_id: string;
  currency: string;
  wewire_account_id: string | null;
  status: VirtualAccountStatus;
  // True when this account was created from a simulated fallback (WeWire's live API failed and
  // the user accepted the "Response from wewire server" popup) rather than a real response.
  is_simulated: boolean;
  account_number: string | null;
  iban: string | null;
  sort_code: string | null;
  routing_number: string | null;
  fund_handling: FundHandling;
  beneficiary_account_id: string | null;
  beneficiary?: WeWireBeneficiaryResponse | null;
  created_at: string;
  updated_at: string;
}

export interface InstallmentResponse {
  id: string;
  payment_plan_id: string;
  sequence: number;
  amount: number;
  currency: string;
  due_date: string | null;
  status: InstallmentStatus;
}

// A trip can have up to one plan per `plan_type` at once (see the backend's
// unique(trip_id, plan_type)) — 'full' and 'installments' are auto-created when an itinerary is
// accepted (DefaultPaymentPlanService), so the traveler can choose which to pay through on the
// public /pay/:reference page (see TravelerView.tsx); 'custom' is the original staff-hand-built
// plan from TripDetail.tsx's payment plan panel (ApiService.createPaymentPlan).
export type PaymentPlanType = 'full' | 'installments' | 'custom';

export interface PaymentPlanResponse {
  id: string;
  trip_id: string;
  payment_reference: string;
  total_amount: number;
  currency: string;
  plan_type: PaymentPlanType;
  status: PaymentPlanStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  installments: InstallmentResponse[];
}

// Returned by the public GET /public/payments/wewire/lookup/{reference} endpoint — what the
// /pay/:reference page renders. payment_account is null until the company has an ACTIVE
// virtual account in the plan's currency.
export interface WeWireLookupResponse {
  payment_reference: string;
  trip_name: string;
  company_name: string;
  total_amount: number;
  currency: string;
  outstanding: number;
  status: PaymentPlanStatus;
  installments: (InstallmentResponse & { paid_amount: number; outstanding: number })[];
  payment_account: {
    currency: string;
    account_number: string | null;
    iban: string | null;
    sort_code: string | null;
    routing_number: string | null;
  } | null;
  // Present (true) only on the response from ApiService.attemptWeWirePayment when WeWire's
  // live account-status check genuinely succeeded — no payment was simulated, it's just
  // confirmation the account is real and ready for the customer to transfer into.
  verified?: boolean;
}

export interface WeWireInboundResponse {
  id: string;
  wewire_transaction_id: string;
  amount: number;
  currency: string;
  reference_raw: string | null;
  matched_payment_reference: string | null;
  status: InboundMatchStatus;
  received_at: string;
  virtual_account?: VirtualAccountResponse;
  installment?: InstallmentResponse & { payment_plan?: { trip?: { trip_id: string; trip_name: string } } };
}

// One payout attempt to an agency's beneficiary — either automatic (source_inbound_id, one
// inbound payment on a "disburse" virtual account) or manually triggered from the dashboard's
// "pay out agency" panel for everything held on a trip (source_trip_id). See
// WeWireDisbursement on the backend. A retry creates a new row rather than reusing this one.
export interface WeWireDisbursementResponse {
  id: string;
  wewire_transaction_id: string | null;
  virtual_account_id: string;
  beneficiary_id: string;
  source_inbound_id: string | null;
  source_trip_id: string | null;
  // Which trip line item this paid for — a flight, an accommodation booking, or an activity
  // (composite-keyed "{itinerary_day_id}:{destination_id}") — null for a trip-level "pay the
  // agency" payout. line_item_label snapshots a human-readable name at payout time.
  line_item_type: 'flight' | 'accommodation' | 'activity' | null;
  line_item_id: string | null;
  line_item_label: string | null;
  amount: number;
  currency: string;
  fee: number | null;
  status: DisbursementStatus;
  // True when this disbursement was recorded from a simulated fallback (WeWire's live payout
  // call failed and the user accepted the "Response from wewire server" popup).
  is_simulated: boolean;
  failure_reason: string | null;
  initiated_at: string;
  settled_at: string | null;
  virtual_account?: VirtualAccountResponse;
  beneficiary?: WeWireBeneficiaryResponse;
  source_trip?: { trip_id: string; trip_name: string };
}

// Returned by GET /wewire/trip-balances — one row per trip with money still held from WeWire
// collections that hasn't been paid out yet. Only trips with a positive held balance are
// included (see WeWirePaymentController::tripBalances). beneficiary_id (when present) is the
// company's default agency-type beneficiary in this currency, for one-click "pay agency" use.
export interface TripBalanceResponse {
  trip_id: string;
  trip_name: string;
  currency: string;
  collected: number;
  held_balance: number;
  beneficiary_id: string | null;
  can_payout: boolean;
}

// Returned by PaystackPaymentController::initiateSubscriptionPayment — `authorization_url` is
// Paystack's hosted checkout page to redirect the customer to.
export interface PaystackCheckoutResponse {
  transaction_id: string;
  authorization_url: string;
}

export interface SkippedProvider {
  name: string;
  reason: 'rate_limited' | 'credit_exhausted';
  retry_after_seconds: number | null;
}

export interface GenerateItineraryApiResponse {
  itinerary: ItineraryResponse;
  all_options: ItineraryResponse[];
  provider_used?: string;
  skipped_providers?: SkippedProvider[];
}

export interface ItineraryResponse {
  itinerary_id: string;
  trip_id: string;
  // A plain user_id string when the `createdBy` relation isn't eager-loaded on the backend;
  // becomes the full {user_id, display_name} object when it is (Laravel's relationsToArray()
  // overwrites the `created_by` attribute key with the loaded relation of the same
  // snake-cased name — see Itinerary::createdBy() on the backend for details).
  created_by: string | { user_id: string; display_name: string } | null;
  itinerary_name: string;
  // The city the traveler departs from for this itinerary — used to default the "From" field
  // in flight search and the destination query in stay search (see TripDetail.tsx).
  start_city: string | null;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  status: ItineraryStatus;
  created_at: string;
  updated_at: string;
  trip?: { trip_id: string; trip_name: string; company_id: string };
  itinerary_days?: ItineraryDayResponse[];
  itinerary_flights?: ItineraryFlightResponse[];
  itinerary_accommodation?: ItineraryAccommodationResponse[];
  source_links?: {
    flights_url?: string | null;
    hotels_url?: string | null;
    events_url?: string | null;
  } | null;
}

export interface FlightLeg {
  label: string;
  date: string;
  time: string;
}

export interface ItineraryDayResponse {
  itinerary_day_id: string;
  itinerary_id: string;
  day_number: number;
  date: string | null;
  title: string | null;
  description: string | null;
  location: string | null;
  destinations?: {
    destination_id: string;
    item_type: 'activity' | 'dining' | 'transfer' | 'venue' | null;
    cost: string | null;
    currency: string | null;
    activities: string | null;
    booking_url: string | null;
    destination?: { destination_id: string; name: string; country: string };
  }[];
}

// One leg of a SerpApi Google Flights result (see SerpApiService::searchFlights) — a
// FlightSearchResult with >1 leg is a connecting itinerary, not a direct flight.
export interface FlightSearchLeg {
  airline: string;
  airline_logo: string | null;
  flight_number: string | null;
  departure_airport: string | null;
  departure_airport_name: string | null;
  departure_time: string | null;
  arrival_airport: string | null;
  arrival_airport_name: string | null;
  arrival_time: string | null;
  duration: number | null;
  airplane: string | null;
}

export interface FlightSearchResult {
  id: string;
  price: number | null;
  currency: string;
  total_duration: number | null;
  stops: number;
  airline_logo: string | null;
  legs: FlightSearchLeg[];
}

export interface FlightSearchResponse {
  currency: string;
  google_flights_url: string | null;
  results: FlightSearchResult[];
  error?: string;
}

// One property from a SerpApi Google Hotels search (see SerpApiService::searchHotels).
export interface HotelSearchResult {
  property_token: string | null;
  name: string;
  link: string | null;
  hotel_class: string | null;
  overall_rating: number | null;
  rate_per_night: number | null;
  total_rate: number | null;
  currency: string;
  thumbnail: string | null;
  gps_coordinates: { latitude: number; longitude: number } | null;
}

export interface HotelSearchResponse {
  currency: string;
  results: HotelSearchResult[];
  error?: string;
}

export interface ItineraryFlightResponse {
  flight_id: string;
  itinerary_id: string;
  airline: string | null;
  flight_number: string | null;
  departure_airport: string | null;
  arrival_airport: string | null;
  departure_datetime: string | null;
  arrival_datetime: string | null;
  cost: number | null;
  currency: string | null;
  booking_reference: string | null;
  booking_url: string | null;
  status: FlightStatus;
}

export interface ItineraryAccommodationResponse {
  accommodation_id: string;
  itinerary_id: string;
  accommodation_name: string;
  address: string | null;
  check_in_date: string | null;
  check_out_date: string | null;
  room_type: string | null;
  cost: number | null;
  currency: string | null;
  booking_reference: string | null;
  booking_url: string | null;
  status: AccommodationStatus;
}

export interface TripResponse {
  trip_id: string;
  company_id: string;
  // Same string-or-object duality as ItineraryResponse.created_by above — see the comment there.
  created_by: string | { user_id: string; display_name: string } | null;
  trip_name: string;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  budget: string | null;
  // Only present on GET /trips (list) — the confirmed itinerary's actual computed cost
  // (flights + accommodation + activities + 5% fee), falling back to the first option if none
  // is confirmed yet, and null if there's no itinerary at all. Use this instead of `budget`
  // (a free-text estimate typed in at trip creation, unrelated to what the itinerary actually
  // costs) whenever showing a trip's "value" — see TripController::index / Trips.tsx.
  computed_total?: number | null;
  computed_currency?: string | null;
  status: TripStatus;
  created_at: string;
  updated_at: string;
  company?: { company_id: string; company_name: string };
  customers?: { customer_id: string; first_name: string; last_name: string; pivot: { role: string } }[];
  itineraries?: ItineraryResponse[];
  calls?: CallResponse[];
  trip_payments?: {
    transaction_id: string;
    trip_id: string;
    notes: string | null;
    transaction?: {
      transaction_id: string;
      amount: number;
      currency: string;
      status: TransactionStatus;
      payment_method: string | null;
      paid_at: string | null;
    };
  }[];
  // Populated on the public GET /public/trips/{trip} response (TripController::publicShow) —
  // every payment plan set up for this trip, so the traveler can pick a plan_type to pay
  // through (see TravelerView.tsx). Not loaded on the authenticated trip endpoints.
  payment_plans?: PaymentPlanResponse[];
}

export interface DestinationResponse {
  destination_id: string;
  name: string;
  country: string | null;
  url: string | null;
}

// A row from the `airports` reference table (see AirportController::search) — used by
// AddFlightModal's city/country → airport picker.
export interface AirportResponse {
  iata_code: string;
  name: string;
  city: string;
  country: string;
}

export interface CallActionItemResponse {
  action_item_id: string;
  call_id: string;
  description: string;
  status: CallActionItemStatus;
}

export interface CallResponse {
  call_id: string;
  trip_id: string;
  // Same string-or-object duality as TripResponse.created_by — see the comment there.
  organized_by: string | { user_id: string; display_name: string } | null;
  title: string | null;
  started_at: string | null;
  ended_at: string | null;
  meeting_link: string | null;
  notes: string | null;
  transcript: string | null;
  // Set when this call was created by/detected from the company's connected Google Calendar
  // (CalendarWatcherJob or the "Schedule with Google Meet" action) — null for a manually logged
  // call with no Calendar backing.
  google_event_id: string | null;
  // When true, CalendarWatcherJob leaves this call alone even though it's calendar-originated.
  excluded: boolean;
  created_at: string;
  updated_at: string;
  trip?: { trip_id: string; trip_name: string; company_id: string };
  action_items?: CallActionItemResponse[];
}

export interface SubscriptionTierResponse {
  tier_id: string;
  name: string;
  price_quarterly: number;
  features: string[] | null;
  status: boolean;
}

export interface CompanySubscriptionResponse {
  subscription_id: string;
  company_id: string;
  tier_id: string;
  start_date: string;
  end_date: string;
  status: string;
  created_at: string;
  updated_at: string;
  company?: { company_id: string; company_name: string };
  tier?: SubscriptionTierResponse;
}

// GET /dashboard response (DashboardController). `user` here is the raw authenticated User
// model (not a custom {id, name, email} shape) — use `display_name`, not `name`.
export interface DashboardResponse {
  user: {
    user_id: string;
    email: string;
    display_name: string;
    phone: string | null;
    avatar_url: string | null;
    status: string;
    last_login: string | null;
    created_at: string;
    updated_at: string;
  };
  revenue: {
    amount: number;
    previous_cmp: number;
  };
  outstanding: {
    amount: number;
    count: number;
  };
  paid_out: {
    amount: number;
    next_payout: string;
  };
  refunds: {
    amount: number;
    count: number;
  };
  latest_trips: DashboardTrip[];
  ai_handled_tasks: number;
  pending_review_tasks: number;
}

// GET /trips/{id}/costs response. One cost breakdown per itinerary option on the trip (in
// the same order as TripResponse.itineraries), plus the trip's payment history and an
// overall summary across ALL itineraries combined (see TripController::costs() on the
// backend). TripDetail.tsx matches an entry here to the currently-selected itinerary by
// array index rather than itinerary_id, since that's simpler and the two arrays are always
// built from the same underlying `$trip->itineraries` relation in the same order.
export interface TripCostResponse {
  trip_id: string;
  itineraries: {
    itinerary_id: string | null;
    currency: string;
    flights: number;
    accommodation: number;
    activities: number;
    subtotal: number;
    service_fee: number;
    total: number;
  }[];
  payments: {
    transaction_id: string;
    amount: number;
    currency: string;
    status: string;
    payment_method: string | null;
    paid_at: string | null;
    notes: string | null;
  }[];
  summary: {
    total_cost: number;
    total_paid: number;
    total_pending: number;
    outstanding: number;
  };
}

// ── Dashboard Types ──
export interface DashboardTrip {
  trip_id: string;
  trip_name: string;
  status: TripStatus;
  start_date: string | null;
  end_date: string | null;
}

// ── Company / Team Types ──
export interface CompanyUser {
  user_id: string;
  firebase_uid: string | null;
  email: string;
  display_name: string;
  phone: string | null;
  avatar_url: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  // is_default/is_enabled come through as 0/1 rather than booleans because the backend's
  // UserCompany pivot model doesn't cast them — compare with `=== 1` or use `!!value`, not
  // strict boolean checks. `is_enabled` is the important one: it marks which company is the
  // user's *active* company for authorization purposes (see User::active_company() on the
  // backend); `is_default` is only a UI hint for which company tab to show first.
  pivot: {
    user_id: string;
    company_id: string;
    role: string;
    is_default: number;
    is_enabled: number;
    joined_at: string;
  };
}

export interface CompanyResponse {
  company_id: string;
  company_name: string;
  country: string | null;
  city_of_operation: string | null;
  status: number;
  // Which currency this company's amounts should be displayed in app-wide — see
  // CurrencyContext, which converts every displayed amount (stored as GHS/whatever its own
  // native currency is) into this before rendering. Defaults to 'GHS' for every company.
  preferred_currency: string;
  created_at: string;
  updated_at: string;
  users: CompanyUser[];
}

// GET /currency-rates response (CurrencyController). `rates` is GHS-per-1-unit for each
// supported currency (rates['GHS'] is always 1) — see App\Services\CurrencyService on the
// backend, which is the single source of truth this table mirrors.
export interface CurrencyRatesResponse {
  base: string;
  rates: Record<string, number>;
}

// GET /gmail/status — reflects the real backend GmailAccount for the caller's company, unlike
// the mocked WhatsApp/Google Meet rows in Settings > Channels which still read from AppContext.
export interface GmailStatusResponse {
  connected: boolean;
  google_email?: string;
  status?: 'active' | 'revoked' | 'error';
  last_synced_at?: string | null;
  // Gmail and Calendar share one connected Google account per company (see GmailController) —
  // these track which of the two this company has actually turned on. meet_tracking_enabled is
  // a further toggle on top of calendar_enabled (same scope, no extra OAuth) — see
  // GmailController::updateMeetTracking().
  gmail_enabled?: boolean;
  calendar_enabled?: boolean;
  meet_tracking_enabled?: boolean;
}

// Real API shapes for GET /conversations, GET /conversations/{id}, PATCH /conversations/{id}
// (ConversationController) — kept separate from the mock Conversation/Message view-model types
// above, which AppContext.fetchConversationsList() reshapes these into (see convoData()).
export interface MessageResponse {
  message_id: string;
  conversation_id: string;
  external_message_id: string | null;
  direction: 'inbound' | 'outbound';
  from_email: string | null;
  from_name: string | null;
  body_text: string | null;
  snippet: string | null;
  sent_at: string | null;
}

export interface ConversationResponse {
  conversation_id: string;
  company_id: string;
  channel: string;
  customer_id: string | null;
  trip_id: string | null;
  external_thread_id: string;
  subject: string | null;
  last_message_at: string | null;
  unread_count: number;
  customer?: { customer_id: string; first_name: string; last_name: string; email: string | null } | null;
  trip?: { trip_id: string; trip_name: string; status: TripStatus; budget: string | null } | null;
  latest_message?: MessageResponse | null;
  // Present only on the GET /conversations/{id} (show) response, not the list.
  messages?: MessageResponse[];
}

// Returned by ConversationController::suggestReply — AI-drafted reply options for the active
// thread, only fetched when the agent clicks "Suggest reply" (never automatically).
export interface SuggestedReply {
  text: string;
  tone: string;
}

export interface SuggestReplyResponse {
  suggestions: SuggestedReply[];
  context_used: string[];
}

// GET /gmail/threads/browse (GmailThreadController) — a candidate Gmail thread not yet tracked
// in Meridian, shown in AddGmailThreadModal's picker.
export interface GmailThreadPreview {
  thread_id: string;
  subject: string | null;
  from_name: string | null;
  from_email: string | null;
  date: string | null;
  snippet: string | null;
}

export interface GmailThreadBrowseResponse {
  threads: GmailThreadPreview[];
  next_page_token: string | null;
}

// Returned by ConversationController::extractTripDetails — "Create trip from this chat"'s AI
// prefill. `customer` is the conversation's already-matched client record (if any, matched by
// email in PollGmailAccountJob), separate from the AI's own `traveler_name` guess — prefer the
// real record over the guess when both are present.
export interface TripDetailsExtraction {
  trip_name: string;
  description: string;
  destinations: string[];
  start_date: string | null;
  end_date: string | null;
  budget: number | null;
  currency: string | null;
  traveler_count: number | null;
  traveler_name: string | null;
  notes: string[];
  customer: { customer_id: string; first_name: string; last_name: string; email: string | null } | null;
}
