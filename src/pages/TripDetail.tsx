import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useApp } from '../contexts/AppContext';
import { useCurrency } from '../contexts/CurrencyContext';
import { ApiService } from '../services/api-service';
import type { TripOption, TripStatusLabel, Day, DayBlock, Flight, Stay, ItineraryResponse, TripResponse, TripCostResponse, CallResponse, ItineraryAccommodationResponse, ItineraryFlightResponse, SkippedProvider, FlightLeg, AgentFeedItem, TripDetailData, StatusBanner, PaymentPlanResponse, TripBalanceResponse, WeWireBeneficiaryResponse, WeWireDisbursementResponse } from '../types/app';
import { TripStatus, ItineraryStatus, FlightStatus, TransactionStatus, CallActionItemStatus } from '../types/app';
import { apiStatusMeta } from '../constants/app';
import AddItemModal, { type EditingDayItem } from '../components/modals/AddItemModal';
import AddFlightModal from '../components/modals/AddFlightModal';
import AddStayModal from '../components/modals/AddStayModal';
import AssignTravelerModal from '../components/modals/AssignTravelerModal';
import EditTripModal from '../components/modals/EditTripModal';
import DemoBanner from '../components/DemoBanner';
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

// Mirrors App\Services\CurrencyService's rate table on the backend — the only currencies a
// convert() call actually has a real rate for. Same list as Settings.tsx's SUPPORTED_CURRENCIES.
const SUPPORTED_CURRENCIES = ['GHS', 'USD', 'EUR', 'GBP'];

// "Nothing loaded yet" placeholder for tripTd/tripTb below — shown for mock trip ids (retired)
// or while a real trip's ApiService.getTrip() fetch is still in flight.
const emptyTd: TripDetailData = {
  name: '', traveler: '', dates: '', where: '', value: '',
  status: 'Draft', statusBg: '#EEF0F4', statusFg: '#5B6172', gradient: 'linear-gradient(135deg,#334155,#7889A6)',
  origin: '', total: '', days: [], costs: [], options: [], optionsLabel: '', headerActions: [],
};
const emptyTb: StatusBanner = {
  bg: '#EEF0F4', border: '#DDE0E8', fg: '#5B6172', iconBg: '#EEF0F4', icon: '•',
  headline: 'Loading trip…', desc: '', descColor: '#8A90A2', chipBorder: '#DDE0E8',
  showRefs: false, refs: [], showBuilder: false, showDraft: false, showOptions: false,
};

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
  flights: ItineraryFlightResponse[] | undefined,
  accommodation: ItineraryAccommodationResponse[] | undefined,
  format: (amount: number, from?: string) => string): Day[] {
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
      // blocks: dayToBlocks(d, format),
      blocks: [...flightBlocks, ...stayBlocks, ...dayToBlocks(d, format)],
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
    cta: f.status === FlightStatus.BOOKED ? 'Selected' : 'Select',
    logoBg: '#2B63F6',
    recDisplay: 'none',
    border: '#ECEDF2',
    bg: '#fff',
    booking_url: f.booking_url ?? null,
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
    booking_url: a.booking_url ?? null,
  }));
}

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

// ── PaymentPlanSection ────────────────────────────────────────
// WeWire installment plan for this trip — the "payment link" flow. If no plan exists yet,
// shows a form to create one (agency defines a fixed set of installments summing to the
// trip's total cost). Once created, shows the reference code customers quote to pay via the
// public /pay/:reference page, plus each installment's status.
function PaymentPlanSection({ tripId, totalCost, currency }: { tripId: string; totalCost: number; currency: string }) {
  const { toastAction } = useApp();
  const [plan, setPlan] = useState<PaymentPlanResponse | null | undefined>(undefined);
  const [creating, setCreating] = useState(false);
  const [installmentCount, setInstallmentCount] = useState(1);
  const [saving, setSaving] = useState(false);
  const [editingRef, setEditingRef] = useState(false);
  const [refDraft, setRefDraft] = useState('');

  useEffect(() => {
    ApiService.getPaymentPlan(tripId).then(setPlan).catch(() => setPlan(null));
  }, [tripId]);

  const publicLink = plan ? `${window.location.origin}/pay/${plan.payment_reference}` : '';

  const handleCreate = async () => {
    if (totalCost <= 0) return;
    setSaving(true);
    try {
      const base = Math.floor((totalCost / installmentCount) * 100) / 100;
      const installments = Array.from({ length: installmentCount }, (_, i) => ({
        amount: i === installmentCount - 1 ? Math.round((totalCost - base * (installmentCount - 1)) * 100) / 100 : base,
      }));
      const created = await ApiService.createPaymentPlan(tripId, { total_amount: totalCost, currency, installments });
      setPlan(created);
      setCreating(false);
      toastAction('Payment plan created');
    } catch (error) {
      toastAction(error instanceof Error ? error.message : 'Failed to create payment plan');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveReference = async () => {
    if (!plan || !refDraft.trim()) return;
    try {
      const updated = await ApiService.updatePaymentPlanReference(plan.id, refDraft.trim().toUpperCase());
      setPlan(updated);
      setEditingRef(false);
      toastAction('Reference code updated');
    } catch (error) {
      toastAction(error instanceof Error ? error.message : 'Failed to update reference code');
    }
  };

  const copyLink = () => {
    navigator.clipboard?.writeText(publicLink);
    toastAction('Payment link copied');
  };

  if (plan === undefined) return null;

  return (
    <div className="td-record-payment" style={{ marginTop: 12 }}>
      <div className="td-cost-divider" />
      <p style={{ fontWeight: 600, fontSize: 13, margin: '8px 0' }}>Customer payment link</p>
      {plan ? (
        <div className="td-payment-form">
          <div className="td-payment-amount-row" style={{ alignItems: 'center' }}>
            {editingRef ? (
              <>
                <input className="td-call-input" value={refDraft} onChange={e => setRefDraft(e.target.value.toUpperCase())} maxLength={8} />
                <button className="td-action-btn" style={{ background: '#13B981', color: '#fff', borderColor: '#13B981' }} onClick={handleSaveReference}>Save</button>
              </>
            ) : (
              <>
                <span style={{ fontFamily: 'monospace', fontSize: 16, fontWeight: 700 }}>{plan.payment_reference}</span>
                <button className="td-action-btn" style={{ background: '#fff', color: '#5B6172', borderColor: '#DDE0E8' }} onClick={() => { setRefDraft(plan.payment_reference); setEditingRef(true); }}>
                  Edit code
                </button>
              </>
            )}
          </div>
          <div className="td-payment-amount-row">
            <input className="td-call-input" value={publicLink} readOnly />
            <button className="td-action-btn" style={{ background: '#2B63F6', color: '#fff', borderColor: '#2B63F6' }} onClick={copyLink}>Copy link</button>
          </div>
          {plan.installments.map(inst => (
            <div key={inst.id} className="td-pay-row">
              <div className="td-pay-info">
                <span className="td-pay-method">Installment {inst.sequence}</span>
                <span className="td-pay-status" data-status={inst.status === 'paid' ? 'completed' : inst.status === 'overdue' ? 'failed' : 'pending'}>{inst.status}</span>
              </div>
              <span className="td-pay-amount">{inst.amount} {inst.currency}</span>
            </div>
          ))}
        </div>
      ) : creating ? (
        <div className="td-payment-form">
          <div className="td-payment-amount-row">
            <label style={{ fontSize: 13, color: '#5B6172' }}>Number of installments</label>
            <input
              className="td-call-input"
              type="number"
              min={1}
              max={12}
              value={installmentCount}
              onChange={e => setInstallmentCount(Math.max(1, Math.min(12, Number(e.target.value) || 1)))}
            />
          </div>
          <p className="field-hint">Total: {totalCost} {currency}, split evenly across {installmentCount} installment{installmentCount > 1 ? 's' : ''}.</p>
          <div className="td-payment-form-actions">
            <button onClick={() => setCreating(false)} className="td-action-btn" style={{ background: '#fff', color: '#5B6172', borderColor: '#DDE0E8' }}>Cancel</button>
            <button onClick={handleCreate} disabled={saving || totalCost <= 0} className="td-action-btn" style={{ background: '#13B981', color: '#fff', borderColor: '#13B981' }}>
              {saving ? 'Creating...' : 'Create plan'}
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => setCreating(true)} className="td-dashed-btn" disabled={totalCost <= 0}>
          + Set up installment plan
        </button>
      )}
    </div>
  );
}

// ── Payable line item shape ─────────────────────────────────────
// A flight, an accommodation booking, or an activity — derived client-side from the trip's
// CONFIRMED itinerary (the booked one), since apiTrip already carries all of this. Activities
// have no single id column on the backend, so their id is composite: "{itinerary_day_id}:
// {destination_id}" — this exact format is also what gets sent as line_item_id on payout and
// matched back against WeWireDisbursementResponse.line_item_id for "already paid."
interface PayableItem {
  type: 'flight' | 'accommodation' | 'activity';
  id: string;
  label: string;
  cost: number;
  currency: string;
}

function payableItemsFromItinerary(itinerary: ItineraryResponse | undefined): PayableItem[] {
  if (!itinerary) return [];
  const items: PayableItem[] = [];

  for (const f of itinerary.itinerary_flights ?? []) {
    items.push({
      type: 'flight',
      id: f.flight_id,
      label: [f.airline || 'Flight', f.flight_number].filter(Boolean).join(' '),
      cost: f.cost ?? 0,
      currency: f.currency ?? 'GHS',
    });
  }
  for (const a of itinerary.itinerary_accommodation ?? []) {
    items.push({
      type: 'accommodation',
      id: a.accommodation_id,
      label: a.accommodation_name,
      cost: a.cost ?? 0,
      currency: a.currency ?? 'GHS',
    });
  }
  for (const day of itinerary.itinerary_days ?? []) {
    for (const d of day.destinations ?? []) {
      items.push({
        type: 'activity',
        id: `${day.itinerary_day_id}:${d.destination_id}`,
        label: d.destination?.name || d.activities || 'Activity',
        cost: Number(d.cost) || 0,
        currency: d.currency ?? 'GHS',
      });
    }
  }
  return items;
}

// ── TripPayoutsSection ────────────────────────────────────────
// Paying the trip's actual service providers (airline, hotel, activity vendors) — and, as a
// catch-all, the agency itself — out of the trip's held WeWire balance, choosing exactly how
// much each gets. Mirrors PaymentPlanSection's self-contained fetch-on-mount pattern.
function TripPayoutsSection({ tripId, itineraries }: { tripId: string; itineraries: ItineraryResponse[] }) {
  const { toastAction } = useApp();
  const [balance, setBalance] = useState<TripBalanceResponse | null | undefined>(undefined);
  const [beneficiaries, setBeneficiaries] = useState<WeWireBeneficiaryResponse[]>([]);
  const [disbursements, setDisbursements] = useState<WeWireDisbursementResponse[]>([]);
  const [payingId, setPayingId] = useState<string | null>(null); // item.id currently being paid, or 'agency'
  const [amountDrafts, setAmountDrafts] = useState<Record<string, string>>({});
  const [beneficiaryDrafts, setBeneficiaryDrafts] = useState<Record<string, string>>({});

  const load = () => {
    Promise.all([
      ApiService.getWeWireTripBalances(),
      ApiService.getWeWireBeneficiaries(),
      ApiService.getWeWireDisbursements(),
    ]).then(([balances, ben, dis]) => {
      setBalance(balances.find(b => b.trip_id === tripId) ?? null);
      setBeneficiaries(ben);
      setDisbursements((dis.data ?? []).filter(d => d.source_trip_id === tripId));
    }).catch(() => setBalance(null));
  };

  useEffect(() => { load(); }, [tripId]);

  const confirmedItinerary = itineraries.find(i => i.status === ItineraryStatus.CONFIRMED);
  const items = payableItemsFromItinerary(confirmedItinerary);

  const paidFor = (item: PayableItem) => disbursements
    .filter(d => d.line_item_type === item.type && d.line_item_id === item.id && (d.status === 'pending' || d.status === 'successful'))
    .reduce((sum, d) => sum + d.amount, 0);

  const heldBalance = balance?.held_balance ?? 0;
  const currency = balance?.currency;

  const handlePay = async (key: string, beneficiaryId: string, amount: number, item?: PayableItem) => {
    if (!beneficiaryId || amount <= 0) return;
    setPayingId(key);
    try {
      await ApiService.payoutTrip(tripId, {
        beneficiary_id: beneficiaryId,
        amount,
        line_item_type: item?.type,
        line_item_id: item?.id,
        line_item_label: item?.label,
      });
      toastAction(item ? `Payout sent for ${item.label}` : 'Payout sent to agency');
      setAmountDrafts(d => ({ ...d, [key]: '' }));
      load();
    } catch (error) {
      toastAction(error instanceof Error ? error.message : 'Failed to send payout');
    } finally {
      setPayingId(null);
    }
  };

  if (balance === undefined) return <div className="td-cost-body"><p>Loading payouts…</p></div>;

  if (!balance) {
    return (
      <div className="td-cost-body">
        <p style={{ color: '#8A90A2', textAlign: 'center', padding: '20px 0', fontSize: 13 }}>
          Nothing has been collected via WeWire for this trip yet — set up a payment plan and collect at least one payment first.
        </p>
      </div>
    );
  }

  const currencyBeneficiaries = (type: 'agency' | 'provider') => beneficiaries.filter(b => b.beneficiary_type === type && b.currency === currency);

  return (
    <div className="td-cost-body">
      <div style={{ background: '#F7F8FA', borderRadius: 8, padding: 16, marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontWeight: 600 }}>Held balance</span>
        <span style={{ fontWeight: 700 }}>{heldBalance} {currency}</span>
      </div>

      {items.length === 0 && (
        <p style={{ color: '#8A90A2', textAlign: 'center', padding: '12px 0', fontSize: 13 }}>
          No confirmed itinerary yet — accept an itinerary option to see its flights, accommodation, and activities here.
        </p>
      )}

      {items.map(item => {
        const key = `${item.type}:${item.id}`;
        const paid = paidFor(item);
        const remaining = Math.max(0, item.cost - paid);
        const providers = currencyBeneficiaries('provider');
        const draftAmount = amountDrafts[key] ?? (remaining > 0 ? String(remaining) : '');
        const draftBeneficiary = beneficiaryDrafts[key] ?? providers[0]?.id ?? '';

        return (
          <div key={key} className="td-pay-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div className="td-pay-info">
                <span className="td-pay-method">{item.label}</span>
                <span className="td-pay-date">{paid > 0 ? `${paid} ${item.currency} paid` : 'Not paid yet'}</span>
              </div>
              <span className="td-pay-amount">{item.cost} {item.currency}</span>
            </div>
            {providers.length === 0 ? (
              <p style={{ fontSize: 12, color: '#B7791F', margin: 0 }}>
                No {item.currency} payout account for this provider yet — add one in Settings &gt; Payments.
              </p>
            ) : (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <select className="td-call-input" value={draftBeneficiary} onChange={e => setBeneficiaryDrafts(d => ({ ...d, [key]: e.target.value }))} style={{ flex: 1 }}>
                  {providers.map(p => <option key={p.id} value={p.id}>{p.label || p.account_name}</option>)}
                </select>
                <input
                  className="td-call-input"
                  type="number"
                  value={draftAmount}
                  onChange={e => setAmountDrafts(d => ({ ...d, [key]: e.target.value }))}
                  style={{ width: 100 }}
                />
                <button
                  className="td-action-btn"
                  style={{ background: '#2B63F6', color: '#fff', borderColor: '#2B63F6' }}
                  disabled={payingId === key || !draftBeneficiary || Number(draftAmount) <= 0 || Number(draftAmount) > heldBalance}
                  onClick={() => handlePay(key, draftBeneficiary, Number(draftAmount), item)}
                >
                  {payingId === key ? 'Paying…' : 'Pay'}
                </button>
              </div>
            )}
          </div>
        );
      })}

      <div className="td-cost-divider" />
      <p style={{ fontWeight: 600, fontSize: 13, margin: '8px 0' }}>Pay the agency</p>
      {(() => {
        const agencyBens = currencyBeneficiaries('agency');
        const key = 'agency';
        const draftAmount = amountDrafts[key] ?? (heldBalance > 0 ? String(heldBalance) : '');
        const draftBeneficiary = beneficiaryDrafts[key] ?? agencyBens[0]?.id ?? '';
        if (agencyBens.length === 0) {
          return <p style={{ fontSize: 12, color: '#B7791F' }}>No {currency} agency payout account yet — add one in Settings &gt; Payments.</p>;
        }
        return (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <select className="td-call-input" value={draftBeneficiary} onChange={e => setBeneficiaryDrafts(d => ({ ...d, [key]: e.target.value }))} style={{ flex: 1 }}>
              {agencyBens.map(b => <option key={b.id} value={b.id}>{b.account_name}</option>)}
            </select>
            <input
              className="td-call-input"
              type="number"
              value={draftAmount}
              onChange={e => setAmountDrafts(d => ({ ...d, [key]: e.target.value }))}
              style={{ width: 100 }}
            />
            <button
              className="td-action-btn"
              style={{ background: '#13B981', color: '#fff', borderColor: '#13B981' }}
              disabled={payingId === key || !draftBeneficiary || Number(draftAmount) <= 0 || Number(draftAmount) > heldBalance}
              onClick={() => handlePay(key, draftBeneficiary, Number(draftAmount))}
            >
              {payingId === key ? 'Paying…' : 'Pay agency'}
            </button>
          </div>
        );
      })()}
    </div>
  );
}

export default function TripDetail() {
  const { tripId } = useParams<{ tripId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const ctx = useApp();
  const { format, convert } = useCurrency();
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
  const [addingOption, setAddingOption] = useState(false);
  const [acceptedItineraryId, setAcceptedItineraryId] = useState<string | null>(null);
  const [acceptingItineraryId, setAcceptingItineraryId] = useState<string | null>(null);
  const [apiCalls, setApiCalls] = useState<CallResponse[]>([]);
  const [newCallTitle, setNewCallTitle] = useState('');
  const [addingCall, setAddingCall] = useState(false);
  // "Schedule with Google Meet" mini-form (Calls tab) — only offered once the company has
  // Calendar connected+enabled (see Settings > Channels' Google Meet card).
  const [calendarEnabled, setCalendarEnabled] = useState(false);
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [scheduleTitle, setScheduleTitle] = useState('');
  const [scheduleStart, setScheduleStart] = useState('');
  const [scheduleEnd, setScheduleEnd] = useState('');
  const [scheduleCustomerId, setScheduleCustomerId] = useState('');
  const [schedulingCall, setSchedulingCall] = useState(false);
  const [newActionItemText, setNewActionItemText] = useState('');
  const [savingActionItem, setSavingActionItem] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentCurrency, setPaymentCurrency] = useState('GHS');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [savingPayment, setSavingPayment] = useState(false);
  const [payingWithMoolre, setPayingWithMoolre] = useState(false);
  // Sidebar tab (Options / Cost summary / Payments / Agent activity) — these used to be two
  // always-open cards (with Payments nested inside Cost summary), switched to a single tabbed
  // card so the user can flip between them instead of scrolling a long stacked sidebar. Options
  // is the primary surface for reviewing/accepting/declining generated itineraries — the
  // full-width per-option card grid that used to sit above the builder was retired in favor
  // of this compact list; clicking a row jumps to that option's itinerary in the builder tab.
  const [sidebarTab, setSidebarTab] = useState<'options' | 'cost' | 'payments' | 'payouts' | 'activity'>('cost');
  const [travelerPackages, setTravelerPackages] = useState<Record<string, string>>({});
  const [bookingAll, setBookingAll] = useState(false);
  const [refineOpen, setRefineOpen] = useState(false);
  const [refineText, setRefineText] = useState('');
  const [refineImageName, setRefineImageName] = useState<string | null>(null);
  const [refineModel, setRefineModel] = useState('claude-sonnet-5');
  const [refineFor, setRefineFor] = useState<'all' | string>('all');
  const [refineTitle, setRefineTitle] = useState('');
  const [includeFlights, setIncludeFlights] = useState(true);
  const [includeStays, setIncludeStays] = useState(true);
  const [includeEvents, setIncludeEvents] = useState(true);
  const [draftStartCity, setDraftStartCity] = useState('');
  const [flightLegs, setFlightLegs] = useState<FlightLeg[]>([
    { label: 'Outbound', date: '', time: '' },
    { label: 'Return',   date: '', time: '' },
  ]);
  const updateLeg = (i: number, field: keyof FlightLeg, val: string) =>
    setFlightLegs(legs => legs.map((l, idx) => idx === i ? { ...l, [field]: val } : l));
  const addLeg = () => setFlightLegs(legs => [
    ...legs.slice(0, -1),
    { label: '', date: '', time: '' },
    legs[legs.length - 1],
  ]);
  const removeLeg = (i: number) => setFlightLegs(legs => legs.filter((_, idx) => idx !== i));
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

  useEffect(() => {
    ApiService.getGmailStatus()
      .then(s => setCalendarEnabled(!!s.calendar_enabled))
      .catch(() => setCalendarEnabled(false));
  }, []);

  const refreshTrip = useCallback(async () => {
    if (!tripId) return;
    const trip = await ApiService.getTrip(tripId);
    setApiTrip(trip);
    return trip;
  }, [tripId]);


  const handleStatusTransition = async (status: TripStatus) => {
    if (!tripId || !apiTrip) return;
    setUpdatingStatus(true);
    try {
      await ApiService.updateTripStatus(tripId, status);
      refreshTrip();
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Once any itinerary on the trip has been selected — the traveler accepted it on their
  // TravelerView link, or the agent accepted it here — the trip is effectively booked, so
  // keep the status dropdown in sync automatically instead of requiring a manual change.
  // Only promotes forward (inquiry/planning → booked); never demotes a status the agent set
  // deliberately (e.g. cancelled), and re-runs harmlessly since the status guard below makes
  // it a no-op once apiTrip.status has already caught up.
  useEffect(() => {
    if (!apiTrip) return;
    const hasSelectedItinerary = (apiTrip.itineraries ?? []).some(it =>
      it.status === ItineraryStatus.CONFIRMED
      || it.status === ItineraryStatus.IN_PROGRESS
      || it.status === ItineraryStatus.COMPLETED
    );
    if (!hasSelectedItinerary) return;
    if (apiTrip.status !== TripStatus.INQUIRY && apiTrip.status !== TripStatus.PLANNING) return;
    handleStatusTransition(TripStatus.BOOKED);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiTrip]);

  const providerLabel = (id: string | undefined) => {
    const map: Record<string, string> = {
      gemini: 'Gemini', openai: 'ChatGPT', anthropic: 'Claude', ollama: 'Ollama',
    };
    return id ? (map[id] ?? id) : 'AI';
  };

  const handleGenerateItinerary = useCallback(async (prefs?: { budget?: string; style?: string; priorities?: string[]; notes?: string; start_city?: string; model?: string; snapshotTitle?: string; include_events?: boolean; flight_departure_time?: string; return_flight_time?: string }) => {
    if (!tripId) return;
    setGeneratingItinerary(true);
    setGenerateError(null);
    try {
      // Merge all persistent generation settings into every call — service toggles,
      // flight legs — so Regenerate and the initial generate button honour them too.
      // start_city from the current itinerary is always included as a fallback so
      // flight search runs on Regenerate even when the caller doesn't pass it explicitly.
      const activeLegs = flightLegs.filter(l => l.date || l.time);
      const enrichedPrefs = {
        ...(selectedItinerary?.start_city ? { start_city: selectedItinerary.start_city } : {}),
        ...prefs,
        include_flights: includeFlights,
        include_stays: includeStays,
        include_events: includeEvents,
        ...(activeLegs.length ? { flight_legs: activeLegs } : {}),
      };
      const result = await ApiService.generateItinerary(tripId, enrichedPrefs);

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
  }, [tripId, ctx, refreshTrip, refreshCosts, setActiveOption, setBuilderTab]);

  // ── Derived data ──
  // tripTd/tripTb build the view-model banner/detail objects straight from apiTrip. There's no
  // more mock-trip source to fall back to — emptyTd/emptyTb below are just the "nothing loaded
  // yet" placeholder (mock trip ids, or a real trip still mid-fetch).

  const tripTd = useMemo((): TripDetailData => {
    if (!apiTrip) return emptyTd;
    const sm = apiStatusMeta[apiTrip.status] ?? { display: apiTrip.status, bg: '#EEF0F4', fg: '#5B6172', gradient: 'linear-gradient(135deg,#334155,#7889A6)' };
    const trav = apiTrip.customers?.[0]
      ? `${apiTrip.customers[0].first_name} ${apiTrip.customers[0].last_name}`
      : (typeof apiTrip.created_by === 'object' && apiTrip.created_by
        ? apiTrip.created_by.display_name
        : 'Traveler');
    return {
      name: apiTrip.trip_name,
      traveler: trav,
      dates: fmtDateRange(apiTrip.start_date, apiTrip.end_date),
      where: apiTrip.description?.split('.')[0] ?? apiTrip.trip_name,
      value: apiTrip.budget ? format(Number(apiTrip.budget), 'GHS') : '',
      status: sm.display as TripStatusLabel,
      statusBg: sm.bg,
      statusFg: sm.fg,
      gradient: sm.gradient,
      origin: apiTrip.customers?.[0]?.last_name ?? 'Traveler',
      total: '',
      days: [],
      costs: [],
      options: [],
      optionsLabel: '',
      headerActions: [],
      // The trip's real description doubles as the "discovery call brief" card's content —
      // previously this always showed demo-trip-0's hardcoded brief regardless of which real
      // trip was open; this is the actual per-trip data it should have been reading all along.
      brief: apiTrip.description ?? undefined,
    };
  }, [apiTrip, format]);

  const tripTb = useMemo(() => {
    if (!apiTrip) return emptyTb;
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
      showBuilder: true,
      showDraft: apiTrip.status === TripStatus.PLANNING || apiTrip.status === TripStatus.INQUIRY,
      showOptions: hasItins,
      showRefs: false,
      refs: [],
    };
  }, [apiTrip]);

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

  const costs = computedCosts?.rows ?? [];
  const costTotal = computedCosts?.total ?? '';
  const costFee = computedCosts?.fee ?? '';
  const payments = computedCosts?.payments ?? [];
  const costSummary = computedCosts?.summary ?? null;
  const costCurrency = computedCosts?.currency ?? 'GHS';

  // Once a trip is booked and has actually received money, land on the Payouts tab by default
  // instead of Cost summary — that's the more useful view at that point (who's been paid,
  // who's still owed). Only fires once per qualifying load so a manual tab click afterward
  // isn't fought over, mirroring Dashboard.tsx's onboarding-progress auto-switch.
  const hasAutoSwitchedToPayouts = useRef(false);
  useEffect(() => {
    if (hasAutoSwitchedToPayouts.current || !apiTrip || !costSummary) return;
    const qualifyingStatus = apiTrip.status === TripStatus.BOOKED || apiTrip.status === TripStatus.IN_PROGRESS || apiTrip.status === TripStatus.COMPLETED;
    if (qualifyingStatus && Number(costSummary.total_paid) > 0) {
      hasAutoSwitchedToPayouts.current = true;
      setSidebarTab('payouts');
    }
  }, [apiTrip, costSummary]);

  const rawDays = hasApiData && selectedItinerary?.itinerary_days
    ? itineraryDaysToDays(
        selectedItinerary.itinerary_days,
        selectedItinerary.itinerary_flights,
        selectedItinerary.itinerary_accommodation,
        format
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
      try { await ApiService.updateItinerary(itineraryId, { status: ItineraryStatus.DRAFT }); } finally { setAcceptingItineraryId(null); }
      return;
    }
    setAcceptedItineraryId(itineraryId);
    setAcceptingItineraryId(itineraryId);
    try {
      await ApiService.updateItinerary(itineraryId, { status: ItineraryStatus.CONFIRMED });
      // Refreshes apiTrip so the auto-booked status effect above sees the newly confirmed
      // itinerary right away, instead of waiting for some unrelated refresh to pick it up.
      await refreshTrip();
    } finally {
      setAcceptingItineraryId(null);
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

  // Creates a real Google Calendar event (auto-generated Meet link) plus a matching Call row.
  const handleScheduleWithMeet = async () => {
    if (!apiTrip || !scheduleTitle.trim() || !scheduleStart || !scheduleEnd || !scheduleCustomerId) return;
    setSchedulingCall(true);
    try {
      await ApiService.scheduleCallWithMeet(apiTrip.trip_id, {
        title: scheduleTitle.trim(),
        started_at: new Date(scheduleStart).toISOString(),
        ended_at: new Date(scheduleEnd).toISOString(),
        customer_id: scheduleCustomerId,
      });
      setScheduleTitle('');
      setScheduleStart('');
      setScheduleEnd('');
      setScheduleCustomerId('');
      setShowScheduleForm(false);
      refreshCalls();
    } catch {
      ctx.toastAction('Could not schedule the Meet call — try again');
    } finally {
      setSchedulingCall(false);
    }
  };

  // Toggles whether CalendarWatcherJob should leave this calendar-originated call alone.
  const handleToggleExcludeCall = async (call: CallResponse) => {
    await ApiService.updateCall(call.call_id, { excluded: !call.excluded });
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
  const handleToggleActionItem = async (itemId: string, currentStatus: CallActionItemStatus) => {
    const next = currentStatus === CallActionItemStatus.CHECKED ? CallActionItemStatus.PENDING : CallActionItemStatus.CHECKED;
    await ApiService.updateCallActionItem(itemId, { status: next });
    refreshCalls();
  };

  // Records a payment against this trip (cost summary sidebar). Marked completed
  // immediately — this app has no separate pending-payment-then-confirm flow yet.
  // The agent can enter the amount in whichever currency they actually collected it in
  // (paymentCurrency) — converted to GHS here so every recorded payment stays comparable
  // regardless of what currency it was typed in, same as the Moolre flow below.
  const handleRecordPayment = async () => {
    if (!apiTrip) return;
    const amount = Number(paymentAmount);
    if (!paymentAmount.trim() || Number.isNaN(amount) || amount <= 0) return;
    setSavingPayment(true);
    try {
      const amountGHS = convert(amount, paymentCurrency, 'GHS');
      // Backend validates amount as a whole integer (no decimals) — round rather than reject.
      await ApiService.recordTripPayment({
        trip_id: apiTrip.trip_id,
        amount: Math.round(amountGHS),
        currency: 'GHS',
        payment_method: paymentMethod.trim() || undefined,
        status: TransactionStatus.COMPLETED,
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
  // Moolre only settles in GHS, so the chosen-currency amount is converted before sending.
  const handlePayWithMoolre = async () => {
    if (!apiTrip) return;
    const amount = Number(paymentAmount);
    if (!paymentAmount.trim() || Number.isNaN(amount) || amount <= 0) return;
    setPayingWithMoolre(true);
    try {
      const amountGHS = convert(amount, paymentCurrency, 'GHS');
      const checkout = await ApiService.initiateMoolreTripPayment(apiTrip.trip_id, Math.round(amountGHS));
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
      await ApiService.updateTripStatus(apiTrip.trip_id, TripStatus.BOOKED);
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
    recognition.onresult = (e: { results: { length: number; [key: number]: { [key: number]: { transcript: string } } }; resultIndex: number }) => {
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
      const pending = (call.action_items ?? []).filter(a => a.status !== CallActionItemStatus.CHECKED).length;
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
      const paid = t.status === TransactionStatus.COMPLETED;
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

  const tripAgent = apiTrip?.created_by
    ? (typeof apiTrip.created_by === 'object' ? apiTrip.created_by.display_name : null)
    : null;

  const builderTabs = [
    { key: 'itinerary' as const, label: 'Itinerary' },
    { key: 'flights' as const, label: 'Flights' },
    { key: 'stays' as const, label: 'Stays' },
    { key: 'activities' as const, label: 'Activities' },
    { key: 'events' as const, label: 'Events' },
    // Calls is accessible via the "Client calls" button below the chat cards, not a builder tab
  ];

  const tabItin = builderTab === 'itinerary';
  const tabFlights = builderTab === 'flights';
  const tabStays = builderTab === 'stays';
  const tabActs = builderTab === 'activities';
  const tabEvents = builderTab === 'events';
  const tabCalls = builderTab === 'calls';

  const handleGenerateOptions = () => {
    if (isRealId) {
      handleGenerateItinerary(draftStartCity ? { start_city: draftStartCity } : undefined);
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

  // Sidebar "Options" tab row click — selects the option and scrolls to the builder so its
  // itinerary is visible, same as the main hero's option pills.
  const jumpToOption = (letter: string) => {
    setActiveOption(letter);
    setBuilderTab('itinerary');
    setTimeout(() => builderRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  };

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
                    onChange={e => handleStatusTransition(e.target.value as TripStatus)}
                    disabled={updatingStatus}
                    aria-label="Change trip status"
                  >
                    {Object.entries(apiStatusMeta).map(([value, meta]) => (
                      <option key={value} value={value}>{meta.display}</option>
                    ))}
                  </select>
                  {apiTrip.status === TripStatus.PLANNING && (
                    <>
                      <button onClick={handleGenerateOptions} className="td-action-btn" style={{ background: '#2B63F6', color: '#fff', borderColor: '#2B63F6' }} disabled={updatingStatus || generatingItinerary}>
                        {generatingItinerary ? '✦ Generating…' : '✦ Generate options'}
                      </button>
                      <button onClick={handleMessageTraveler} className="td-action-btn" style={{ background: '#fff', color: '#5B6172', borderColor: '#DDE0E8' }}>
                        Message {td.traveler.split(' ')[0]}
                      </button>
                    </>
                  )}
                  {apiTrip.status === TripStatus.INQUIRY && (
                    <>
                      <button onClick={handleOpenTravelerView} className="td-action-btn" style={{ background: '#fff', color: '#5B6172', borderColor: '#DDE0E8' }}>Preview</button>
                      <button onClick={handleShareTravelerView} className="td-action-btn" style={{ background: '#2B63F6', color: '#fff', borderColor: '#2B63F6' }}>
                        Share trip
                      </button>
                    </>
                  )}
                  {apiTrip.status === TripStatus.BOOKED && (
                    <>
                      <button onClick={handleOpenTravelerView} className="td-action-btn" style={{ background: '#fff', color: '#5B6172', borderColor: '#DDE0E8' }}>View trip pack</button>
                      <button onClick={handleMessageTraveler} className="td-action-btn" style={{ background: '#2B63F6', color: '#fff', borderColor: '#2B63F6' }}>
                        Message {td.traveler.split(' ')[0]}
                      </button>
                    </>
                  )}
                  {apiTrip.status === TripStatus.IN_PROGRESS && (
                    <>
                      <button onClick={handleOpenTravelerView} className="td-action-btn" style={{ background: '#fff', color: '#5B6172', borderColor: '#DDE0E8' }}>Preview</button>
                      <button onClick={() => handleStatusTransition(TripStatus.COMPLETED)} className="td-action-btn" style={{ background: '#13B981', color: '#fff', borderColor: '#13B981' }} disabled={updatingStatus}>
                        Complete trip
                      </button>
                    </>
                  )}
                  {apiTrip.status === TripStatus.COMPLETED && (
                    <>
                      <button onClick={handleOpenTravelerView} className="td-action-btn" style={{ background: '#fff', color: '#5B6172', borderColor: '#DDE0E8' }}>View trip pack</button>
                      <button onClick={() => handleStatusTransition(TripStatus.IN_PROGRESS)} className="td-action-btn" style={{ background: '#EB8C2B', color: '#fff', borderColor: '#EB8C2B' }} disabled={updatingStatus}>
                        Reopen
                      </button>
                    </>
                  )}
                  {apiTrip.status === TripStatus.CANCELLED && (
                    <>
                      <button onClick={handleOpenTravelerView} className="td-action-btn" style={{ background: '#fff', color: '#5B6172', borderColor: '#DDE0E8' }}>Preview</button>
                      <button onClick={() => handleStatusTransition(TripStatus.PLANNING)} className="td-action-btn" style={{ background: '#2B63F6', color: '#fff', borderColor: '#2B63F6' }} disabled={updatingStatus}>
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
              <div
                className="td-add-option"
                onClick={addingOption ? undefined : handleAddOption}
                style={addingOption ? { opacity: 0.6, cursor: 'default' } : undefined}
              >
                <span className="td-add-option-plus">+</span>
                <span className="td-add-option-label">{addingOption ? 'Adding…' : 'Add option'}</span>
              </div>
            </div>
            {(() => {
              const customers = apiTrip.customers ?? [];
              const allAccepted = customers.length > 0 && customers.every(c => travelerPackages[c.customer_id] && travelerPackages[c.customer_id] !== 'cancelled');
              const allSamePkg = allAccepted && new Set(customers.map(c => travelerPackages[c.customer_id])).size === 1;
              const anyActive = customers.some(c => !travelerPackages[c.customer_id] || travelerPackages[c.customer_id] !== 'cancelled');
              return (
                <div className="td-tr-actions">
                  {allSamePkg && apiTrip.status !== TripStatus.BOOKED && (
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
                  {anyActive && apiTrip.status !== TripStatus.CANCELLED && (
                    <button
                      className="td-tr-cancel-btn"
                      onClick={() => handleStatusTransition(TripStatus.CANCELLED)}
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

        {generatingItinerary && (
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
                <div className="td-brief-services">
                  <span className="td-brief-services-label">Include live data:</span>
                  <button
                    className={`td-service-pill${includeFlights ? ' td-service-pill--on' : ''}`}
                    onClick={() => setIncludeFlights(f => !f)}
                  >✈ Flights</button>
                  <button
                    className={`td-service-pill${includeStays ? ' td-service-pill--on' : ''}`}
                    onClick={() => setIncludeStays(f => !f)}
                  >🏨 Hotels</button>
                  <button
                    className={`td-service-pill${includeEvents ? ' td-service-pill--on' : ''}`}
                    onClick={() => setIncludeEvents(f => !f)}
                  >🎟 Events</button>
                </div>
                <div className="td-brief-departure-row">
                  <label className="td-brief-departure-label">Departure city</label>
                  <input
                    type="text"
                    className="td-brief-departure-input"
                    value={draftStartCity}
                    onChange={e => setDraftStartCity(e.target.value)}
                    placeholder="e.g. Accra, New York, London"
                  />
                </div>
                <div className="td-brief-flight-legs">
                  <div className="td-flight-legs-header">
                    <span className="td-flight-legs-label">✈ Flight schedule</span>
                    <button className="td-leg-add-btn" onClick={addLeg} title="Add a city stop">+ city</button>
                  </div>
                  {flightLegs.map((leg, i) => (
                    <div key={i} className="td-leg-row">
                      <input
                        type="text"
                        className="td-leg-label"
                        value={leg.label}
                        onChange={e => updateLeg(i, 'label', e.target.value)}
                        placeholder={i === 0 ? 'Outbound' : i === flightLegs.length - 1 ? 'Return' : 'City stop'}
                      />
                      <input
                        type="date"
                        className="td-leg-date"
                        value={leg.date}
                        onChange={e => updateLeg(i, 'date', e.target.value)}
                      />
                      <input
                        type="time"
                        className="td-leg-time"
                        value={leg.time}
                        onChange={e => updateLeg(i, 'time', e.target.value)}
                      />
                      {flightLegs.length > 2 && i !== 0 && i !== flightLegs.length - 1 && (
                        <button className="td-leg-remove-btn" onClick={() => removeLeg(i)}>×</button>
                      )}
                    </div>
                  ))}
                </div>
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
                    {selectedItinerary?.source_links && Object.values(selectedItinerary.source_links).some(Boolean) && (
                      <div className="td-source-links">
                        <span className="td-source-links-label">Generation sources:</span>
                        {selectedItinerary.source_links.flights_url && (
                          <a href={selectedItinerary.source_links.flights_url} target="_blank" rel="noopener noreferrer" className="td-source-link">✈ View flights search</a>
                        )}
                        {selectedItinerary.source_links.hotels_url && (
                          <a href={selectedItinerary.source_links.hotels_url} target="_blank" rel="noopener noreferrer" className="td-source-link">🏨 View hotels search</a>
                        )}
                        {selectedItinerary.source_links.events_url && (
                          <a href={selectedItinerary.source_links.events_url} target="_blank" rel="noopener noreferrer" className="td-source-link">🎟 View events</a>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {tabFlights && (
                  <div>
                    {selectedItinerary?.source_links?.flights_url && (
                      <div className="td-source-links" style={{ marginBottom: 12 }}>
                        <span className="td-source-links-label">Source:</span>
                        <a href={selectedItinerary.source_links.flights_url} target="_blank" rel="noopener noreferrer" className="td-source-link">✈ Open Google Flights search →</a>
                      </div>
                    )}
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
                            {f.booking_url && (
                              <a href={f.booking_url} target="_blank" rel="noopener noreferrer" className="td-item-source-link">View source →</a>
                            )}
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
                    {selectedItinerary?.source_links?.hotels_url && (
                      <div className="td-source-links" style={{ marginBottom: 12 }}>
                        <span className="td-source-links-label">Source:</span>
                        <a href={selectedItinerary.source_links.hotels_url} target="_blank" rel="noopener noreferrer" className="td-source-link">🏨 Open hotels search →</a>
                      </div>
                    )}
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
                              {st.booking_url && (
                                <a href={st.booking_url} target="_blank" rel="noopener noreferrer" className="td-item-source-link">View source →</a>
                              )}
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
                    {!apiTrip && <DemoBanner label="Demo feature — activity catalog is sample data" />}
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

                {tabEvents && (
                  <div>
                    {selectedItinerary?.source_links?.events_url && (
                      <div className="td-source-links" style={{ marginBottom: 12 }}>
                        <span className="td-source-links-label">Source:</span>
                        <a href={selectedItinerary.source_links.events_url} target="_blank" rel="noopener noreferrer" className="td-source-link">🎟 Open Ticketmaster events search →</a>
                      </div>
                    )}
                    <p className="td-acts-desc">Events and experiences woven into this itinerary.</p>
                    {apiTrip ? (
                      <>
                        {realActivities && realActivities.length > 0 ? (
                          <div className="td-events-timeline">
                            {(selectedItinerary?.itinerary_days ?? []).map((day, di) => {
                              const dests = day.destinations ?? [];
                              if (dests.length === 0) return null;
                              const dt = day.date ? new Date(day.date) : null;
                              return (
                                <div key={di} className="td-events-day-group">
                                  <div className="td-events-day-header">
                                    <span className="td-events-day-label">
                                      {dt
                                        ? dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
                                        : `Day ${day.day_number}`}
                                    </span>
                                    {day.title && <span className="td-events-day-title">{day.title}</span>}
                                  </div>
                                  {dests.map((dest, ei) => (
                                    <div key={ei} className="td-event-row">
                                      <div className="td-event-icon">🎟</div>
                                      <div className="td-event-body">
                                        <div className="td-event-name">{dest.destination?.name ?? 'Event'}</div>
                                        {dest.activities && (
                                          <div className="td-event-activities">{dest.activities}</div>
                                        )}
                                        <div className="td-event-meta-row">
                                          {dest.cost ? (
                                            <span className="td-event-price">{dest.currency ?? ''} {Number(dest.cost).toLocaleString()}</span>
                                          ) : null}
                                          {dest.booking_url && (
                                            <a href={dest.booking_url} target="_blank" rel="noopener noreferrer" className="td-item-source-link">View source →</a>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="td-acts-empty">No events added yet. Generate an itinerary with events enabled to populate this tab.</p>
                        )}
                        <button
                          onClick={handleOpenAddActivity}
                          className="td-dashed-btn"
                          style={{ marginTop: 12 }}
                          disabled={bootstrapping}
                        >
                          {bootstrapping ? 'One moment…' : '+ Add event'}
                        </button>
                      </>
                    ) : (
                      <p className="td-acts-empty">Open a real trip to manage events.</p>
                    )}
                  </div>
                )}

                {tabCalls && (
                  <div>
                    {!apiTrip && <DemoBanner label="Demo feature — call log is sample data" />}
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

                          {calendarEnabled && (
                            showScheduleForm ? (
                              <div className="td-add-call-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
                                <input
                                  value={scheduleTitle}
                                  onChange={e => setScheduleTitle(e.target.value)}
                                  placeholder="Call title (e.g. Discovery call)"
                                  className="td-call-input"
                                />
                                <select
                                  value={scheduleCustomerId}
                                  onChange={e => setScheduleCustomerId(e.target.value)}
                                  className="td-call-input"
                                >
                                  <option value="">Select a traveler…</option>
                                  {(apiTrip?.customers ?? []).map(c => (
                                    <option key={c.customer_id} value={c.customer_id}>{c.first_name} {c.last_name}</option>
                                  ))}
                                </select>
                                <input
                                  type="datetime-local"
                                  value={scheduleStart}
                                  onChange={e => setScheduleStart(e.target.value)}
                                  className="td-call-input"
                                />
                                <input
                                  type="datetime-local"
                                  value={scheduleEnd}
                                  onChange={e => setScheduleEnd(e.target.value)}
                                  className="td-call-input"
                                />
                                <div style={{ display: 'flex', gap: 8 }}>
                                  <button
                                    onClick={handleScheduleWithMeet}
                                    disabled={schedulingCall || !scheduleTitle.trim() || !scheduleStart || !scheduleEnd || !scheduleCustomerId}
                                    className="td-dashed-btn"
                                  >
                                    {schedulingCall ? 'Scheduling…' : 'Schedule Meet call'}
                                  </button>
                                  <button onClick={() => setShowScheduleForm(false)} className="td-dashed-btn">Cancel</button>
                                </div>
                              </div>
                            ) : (
                              <button onClick={() => setShowScheduleForm(true)} className="td-dashed-btn" style={{ width: '100%', marginTop: 8 }}>
                                🎥 Schedule with Google Meet
                              </button>
                            )
                          )}
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
                              {selectedCall.google_event_id && (
                                <button
                                  onClick={() => handleToggleExcludeCall(selectedCall)}
                                  className="td-call-badge td-call-end-btn"
                                  title="Google Calendar keeps syncing this call's details unless excluded"
                                >
                                  {selectedCall.excluded ? '↺ Re-include in auto-tracking' : '⊘ Exclude from auto-tracking'}
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
                                      style={a.status === CallActionItemStatus.CHECKED ? { background: '#0E9F6E', color: '#fff' } : undefined}
                                      title="Toggle done"
                                    >
                                      {a.status === CallActionItemStatus.CHECKED ? '✓' : i + 1}
                                    </button>
                                    <span
                                      className="td-call-action-text"
                                      style={a.status === CallActionItemStatus.CHECKED ? { textDecoration: 'line-through', color: '#AEB3C2' } : undefined}
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
                  </div>
                )}
              </div>
            </div>

            <div className="td-sticky-sidebar">
              <div className="td-right-card">
                <div className="td-tabs-bar">
                  {tb.showOptions && (
                    <button className={'td-tab-btn' + (sidebarTab === 'options' ? ' td-tab-btn--active' : '')} onClick={() => setSidebarTab('options')}>
                      Options
                    </button>
                  )}
                  <button className={'td-tab-btn' + (sidebarTab === 'cost' ? ' td-tab-btn--active' : '')} onClick={() => setSidebarTab('cost')}>
                    Cost summary
                  </button>
                  <button className={'td-tab-btn' + (sidebarTab === 'payments' ? ' td-tab-btn--active' : '')} onClick={() => setSidebarTab('payments')}>
                    Payments
                  </button>
                  <button className={'td-tab-btn' + (sidebarTab === 'payouts' ? ' td-tab-btn--active' : '')} onClick={() => setSidebarTab('payouts')}>
                    Payouts
                  </button>
                  <button className={'td-tab-btn' + (sidebarTab === 'activity' ? ' td-tab-btn--active' : '')} onClick={() => setSidebarTab('activity')}>
                    Agent activity
                  </button>
                </div>

                {sidebarTab === 'options' && (
                  <div className="td-sidebar-options-body">
                    {apiTrip && (
                      <div className="td-sidebar-options-toolbar">
                        <button
                          className="td-sidebar-opt-tool-btn"
                          onClick={() => setRefineOpen(true)}
                          disabled={generatingItinerary}
                        >
                          ✦ Refine
                        </button>
                        <button
                          className="td-sidebar-opt-tool-btn"
                          onClick={() => handleGenerateItinerary()}
                          disabled={generatingItinerary}
                        >
                          {generatingItinerary ? 'Generating…' : '↺ Regenerate'}
                        </button>
                      </div>
                    )}
                    {options.length === 0 && (
                      <div className="td-sidebar-options-empty">All options were declined.</div>
                    )}
                    {options.map(opt => {
                      const itin = (apiTrip?.itineraries ?? []).find(it => it.itinerary_id === opt.itineraryId);
                      const cost = computeOptionCost(itin);
                      const isAccepted = acceptedItineraryId === opt.itineraryId;
                      const isBusy = removingItinerary || acceptingItineraryId === opt.itineraryId;
                      return (
                        <div
                          key={opt.letter}
                          className={'td-sidebar-opt-row' + (activeOption === opt.letter ? ' td-sidebar-opt-row--active' : '')}
                          onClick={() => jumpToOption(opt.letter)}
                        >
                          <div className="td-sidebar-opt-avatar" style={{ background: isAccepted ? '#13B981' : opt.cover }}>
                            {isAccepted ? '✓' : opt.letter}
                          </div>
                          <div className="td-sidebar-opt-info">
                            <div className="td-sidebar-opt-name">{opt.name}</div>
                            {cost?.hasData && <div className="td-sidebar-opt-cost">{cost.total}</div>}
                          </div>
                          <div className="td-sidebar-opt-actions" onClick={e => e.stopPropagation()}>
                            {isAccepted ? (
                              <button
                                className="td-sidebar-opt-btn"
                                disabled={isBusy}
                                onClick={() => handleAcceptItinerary(opt.itineraryId)}
                              >
                                Accepted
                              </button>
                            ) : (
                              <>
                                <button
                                  className="td-sidebar-opt-btn td-sidebar-opt-btn--accept"
                                  disabled={isBusy}
                                  onClick={() => handleAcceptItinerary(opt.itineraryId)}
                                >
                                  Accept
                                </button>
                                <button
                                  className="td-sidebar-opt-btn td-sidebar-opt-btn--decline"
                                  disabled={isBusy}
                                  onClick={() => handleDeclineItinerary(opt.itineraryId)}
                                >
                                  Decline
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

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
                            <div className="td-payment-amount-row">
                              <input
                                value={paymentAmount}
                                onChange={e => setPaymentAmount(e.target.value)}
                                placeholder={`Amount (${paymentCurrency})`}
                                type="number"
                                className="td-call-input"
                              />
                              <select
                                value={paymentCurrency}
                                onChange={e => setPaymentCurrency(e.target.value)}
                                className="td-call-input td-payment-currency-select"
                                aria-label="Payment currency"
                              >
                                {SUPPORTED_CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                              </select>
                            </div>
                            {paymentCurrency !== 'GHS' && paymentAmount.trim() && !Number.isNaN(Number(paymentAmount)) && (
                              <div className="td-payment-convert-hint">
                                ≈ {format(convert(Number(paymentAmount), paymentCurrency, 'GHS'), 'GHS')} — payments are settled/recorded in GHS
                              </div>
                            )}
                            <input
                              value={paymentMethod}
                              onChange={e => setPaymentMethod(e.target.value)}
                              placeholder="Method (e.g. Paystack, bank transfer)"
                              className="td-call-input"
                            />
                            <div className="td-payment-form-actions">
                              <button
                                onClick={() => { setShowPaymentForm(false); setPaymentAmount(''); setPaymentMethod(''); setPaymentCurrency(costCurrency); }}
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
                          <button onClick={() => { setShowPaymentForm(true); setPaymentCurrency(costCurrency); }} className="td-dashed-btn">
                            + Record payment
                          </button>
                        )}
                      </div>
                    )}
                    {apiTrip && (
                      <PaymentPlanSection tripId={apiTrip.trip_id} totalCost={Number(costSummary?.total_cost ?? 0)} currency={costCurrency} />
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

                {sidebarTab === 'payouts' && apiTrip && (
                  <TripPayoutsSection tripId={apiTrip.trip_id} itineraries={apiTrip.itineraries ?? []} />
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

            {/* Flight legs — date + time per leg, multi-city supported */}
            <div className="td-refine-flight-legs">
              <div className="td-flight-legs-header">
                <span className="td-refine-label">✈ Flight schedule</span>
                <button className="td-leg-add-btn" onClick={addLeg} title="Add a city stop">+ city</button>
              </div>
              {flightLegs.map((leg, i) => (
                <div key={i} className="td-leg-row">
                  <input
                    type="text"
                    className="td-leg-label"
                    value={leg.label}
                    onChange={e => updateLeg(i, 'label', e.target.value)}
                    placeholder={i === 0 ? 'Outbound' : i === flightLegs.length - 1 ? 'Return' : 'City stop'}
                  />
                  <input
                    type="date"
                    className="td-leg-date"
                    value={leg.date}
                    onChange={e => updateLeg(i, 'date', e.target.value)}
                  />
                  <input
                    type="time"
                    className="td-leg-time"
                    value={leg.time}
                    onChange={e => updateLeg(i, 'time', e.target.value)}
                  />
                  {flightLegs.length > 2 && i !== 0 && i !== flightLegs.length - 1 && (
                    <button className="td-leg-remove-btn" onClick={() => removeLeg(i)}>×</button>
                  )}
                </div>
              ))}
            </div>

            {/* Service toggles — shared with the main chat area */}
            <div className="td-refine-services-row">
              <span className="td-refine-label">Include live data:</span>
              <button
                className={`td-service-pill${includeFlights ? ' td-service-pill--on' : ''}`}
                onClick={() => setIncludeFlights(f => !f)}
              >✈ Flights</button>
              <button
                className={`td-service-pill${includeStays ? ' td-service-pill--on' : ''}`}
                onClick={() => setIncludeStays(f => !f)}
              >🏨 Hotels</button>
              <button
                className={`td-service-pill${includeEvents ? ' td-service-pill--on' : ''}`}
                onClick={() => setIncludeEvents(f => !f)}
              >🎟 Events</button>
            </div>

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
