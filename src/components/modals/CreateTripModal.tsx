import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../contexts/AppContext';
import '../../styles/CreateTripModal.css';
import { ApiService } from '../../services/api-service';
import { useAuth } from '../../contexts/AuthContext';
import { MERIDIAN_AI_PROVIDER_KEY } from '../../pages/Settings';
import type { CustomerResponse } from '../../types/app';
import { TripStatus } from '../../types/app';

// ── CreateTripModal ──────────────────────────────────────────────────────────
// Two-mode trip creation:
//  - DRAFT: fill in structured fields, AI generates, save for customer
//  - CHAT:  type or speak in natural language, AI replies, select & save option

const keyframes = `
@keyframes mbar { 0% { width:0 } 50% { width:65% } 100% { width:100% } }
@keyframes mspin { to { transform:rotate(360deg) } }
@keyframes ctm-fade-in { from { opacity:0; transform:translateY(6px) } to { opacity:1; transform:translateY(0) } }
`;

type Phase = 'customer' | 'mode' | 'draft' | 'chat' | 'generating' | 'done';
type ChatMsg = { role: 'ai' | 'agent'; text: string };

function parseTrip(text: string): { destinations: string[]; budget: string } {
  const toPattern = /\bto\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)/g;
  const destinations: string[] = [];
  let m;
  while ((m = toPattern.exec(text)) !== null) {
    if (!['the','a','an','our','my','your'].includes(m[1].toLowerCase())) {
      destinations.push(m[1]);
    }
  }
  const andPattern = /([A-Z][a-zA-Z]+)\s+(?:and|then)\s+([A-Z][a-zA-Z]+)/g;
  while ((m = andPattern.exec(text)) !== null) {
    [m[1], m[2]].forEach(c => { if (!destinations.find(d => d.toLowerCase() === c.toLowerCase())) destinations.push(c); });
  }
  const budgetMatch = text.match(/(?:\$|USD|GHS|€)\s*([0-9][0-9,]*)/i);
  const budget = budgetMatch ? budgetMatch[1].replace(/,/g, '') : '';
  return { destinations: [...new Set(destinations)], budget };
}

export default function CreateTripModal() {
  const navigate = useNavigate();
  const { createOpen, createStep, createFromConvo, createdTripId, closeCreate, startSearch } = useApp();
  const { user } = useAuth();

  const [phase, setPhase] = useState<Phase>('customer');

  // Customer selection
  const [customers, setCustomers] = useState<CustomerResponse[]>([]);
  const [custSearch, setCustSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerResponse | null>(null);
  const [isGuest, setIsGuest] = useState(false);
  const [guestName, setGuestName] = useState('');
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [showCreateTraveler, setShowCreateTraveler] = useState(false);
  const [newFirstName, setNewFirstName] = useState('');
  const [newLastName, setNewLastName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [creatingTraveler, setCreatingTraveler] = useState(false);
  const [createTravelerError, setCreateTravelerError] = useState('');

  // Draft mode
  const [tripName, setTripName] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [budget, setBudget] = useState('');
  const [destinations, setDestinations] = useState<string[]>([]);
  const [newDest, setNewDest] = useState('');
  const [addingDest, setAddingDest] = useState(false);

  // Chat mode
  const [messages, setMessages] = useState<ChatMsg[]>([
    { role: 'ai', text: "Describe the trip you want to create — destination(s), dates, number of travelers, budget, and any preferences. I'll build the options from there." }
  ]);
  const [chatDraft, setChatDraft] = useState('');
  const [chatTripName, setChatTripName] = useState('');
  const [chatPhase, setChatPhase] = useState<'initial' | 'needName' | 'confirm'>('initial');
  const [chatDests, setChatDests] = useState<string[]>([]);
  const [chatBudget, setChatBudget] = useState('');
  const [recording, setRecording] = useState(false);
  const recognitionRef = useRef<any>(null); // eslint-disable-line @typescript-eslint/no-explicit-any

  const chatEndRef = useRef<HTMLDivElement>(null);

  const companyId = user?.companies?.find(c => c.pivot.is_default)?.company_id ?? user?.companies?.[0]?.company_id ?? '';

  const hasSpeech = typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  // Load customers when modal opens
  useEffect(() => {
    if (!createOpen) {
      setPhase('customer');
      setSelectedCustomer(null);
      setIsGuest(false);
      setGuestName('');
      setCustSearch('');
      setSearchFocused(false);
      setShowCreateTraveler(false);
      setNewFirstName('');
      setNewLastName('');
      setNewEmail('');
      setCreateTravelerError('');
      setMessages([{ role: 'ai', text: "Describe the trip you want to create — destination(s), dates, number of travelers, budget, and any preferences. I'll build the options from there." }]);
      setChatDraft('');
      setChatTripName('');
      setChatPhase('initial');
      setChatDests([]);
      setChatBudget('');
      setTripName('');
      setDescription('');
      setStartDate('');
      setEndDate('');
      setBudget('');
      setDestinations([]);
      return;
    }
    setLoadingCustomers(true);
    ApiService.getCustomers().then(r => setCustomers(r.data ?? [])).catch(() => {}).finally(() => setLoadingCustomers(false));
  }, [createOpen]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (!createOpen) return null;

  // Sync with AppContext's step when startSearch() is called (steps 2 and 3)
  const effectivePhase = createStep === 2 ? 'generating' : createStep === 3 ? 'done' : phase;

  const travelerName = isGuest
    ? (guestName.trim() || 'Guest')
    : selectedCustomer
      ? `${selectedCustomer.first_name} ${selectedCustomer.last_name}`
      : '';

  // ── Shared trip creation ─────────────────────────────────────
  const createTrip = async (name: string, desc: string, sd?: string, ed?: string, bgt?: string) => {
    if (!companyId) {
      setMessages(prev => [...prev, {
        role: 'ai',
        text: "I couldn't find your company account. Please contact your administrator before creating trips."
      }]);
      return;
    }
    const tripId = await ApiService.createTrip({
      company_id: companyId,
      created_by: user?.user_id,
      trip_name: name,
      description: desc,
      start_date: sd || undefined,
      end_date: ed || undefined,
      budget: bgt || undefined,
      status: TripStatus.PLANNING,
    }).then(r => r.trip_id);

    if (selectedCustomer) {
      await ApiService.addCustomerToTrip(tripId, selectedCustomer.customer_id).catch(() => {});
    }
    startSearch(tripId);
  };

  // ── Draft mode handlers ──────────────────────────────────────
  const handleDraftGenerate = async () => {
    if (!tripName.trim()) return;
    const descParts = [description, destinations.length ? `Destinations: ${destinations.join(', ')}` : ''].filter(Boolean);
    await createTrip(tripName, descParts.join('\n'), startDate, endDate, budget);
  };

  // ── Chat mode handlers ───────────────────────────────────────
  const handleChatSend = () => {
    const text = chatDraft.trim();
    if (!text) return;
    if (recognitionRef.current) { recognitionRef.current.stop(); setRecording(false); }
    setMessages(prev => [...prev, { role: 'agent', text }]);
    setChatDraft('');

    if (chatPhase === 'initial') {
      const parsed = parseTrip(text);
      setChatDests(parsed.destinations);
      if (parsed.budget) setChatBudget(parsed.budget);

      const destStr = parsed.destinations.length ? parsed.destinations.join(' → ') + ' ' : '';
      setMessages(prev => [...prev, {
        role: 'ai',
        text: `Got it — ${destStr}${parsed.budget ? `budget ${parsed.budget} — ` : ''}what should we call this trip?`
      }]);
      setChatPhase('needName');
    } else if (chatPhase === 'needName') {
      setChatTripName(text);
      const provider = localStorage.getItem(MERIDIAN_AI_PROVIDER_KEY) ?? '';
      const modelNote = provider ? ` using ${provider}` : '';
      setMessages(prev => [...prev, {
        role: 'ai',
        text: `"${text}" — ready to generate${modelNote}. Should I save this trip for ${travelerName}?`
      }]);
      setChatPhase('confirm');
    } else if (chatPhase === 'confirm') {
      // In confirm phase the textarea is hidden; any stray Enter goes back to initial
      // (real confirm/cancel is handled by the action buttons below the thread)
      setMessages(prev => [...prev, { role: 'ai', text: 'Use the buttons below to confirm or start over.' }]);
    }
  };

  const toggleVoice = () => {
    if (!hasSpeech) return;
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
      setRecording(false);
      return;
    }
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition; // eslint-disable-line @typescript-eslint/no-explicit-any
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = false;
    rec.lang = 'en-US';
    rec.onresult = (e: SpeechRecognitionEvent) => {
      const t = Array.from(e.results).map((r: SpeechRecognitionResult) => r[0].transcript).join(' ');
      setChatDraft(prev => prev ? `${prev} ${t}` : t);
    };
    rec.onend = () => { setRecording(false); recognitionRef.current = null; };
    rec.onerror = () => { setRecording(false); recognitionRef.current = null; };
    recognitionRef.current = rec;
    rec.start();
    setRecording(true);
  };

  const filteredCustomers = customers.filter(c =>
    `${c.first_name} ${c.last_name} ${c.email ?? ''}`.toLowerCase().includes(custSearch.toLowerCase())
  );

  // Quick-create pattern mirrored from AssignTravelerModal — lets the agent create a real
  // traveler profile right here instead of falling back to "Continue as guest" whenever the
  // search comes up empty. The new customer becomes the selected traveler immediately.
  const handleCreateTraveler = async () => {
    if (!companyId || !newFirstName.trim() || !newLastName.trim()) return;
    setCreatingTraveler(true);
    setCreateTravelerError('');
    try {
      const created = await ApiService.createCustomer({
        company_id: companyId,
        first_name: newFirstName.trim(),
        last_name: newLastName.trim(),
        email: newEmail.trim() || null,
      });
      setCustomers(prev => [created, ...prev]);
      setSelectedCustomer(created);
      setIsGuest(false);
      setShowCreateTraveler(false);
      setNewFirstName('');
      setNewLastName('');
      setNewEmail('');
      setCustSearch(`${created.first_name} ${created.last_name}`);
      setSearchFocused(false);
    } catch {
      setCreateTravelerError('Could not create this traveler.');
    } finally {
      setCreatingTraveler(false);
    }
  };

  const handleOpenCreatedTrip = () => {
    closeCreate();
    navigate('/app/trips/' + (createdTripId ?? '0'), { state: { triggerGenerate: true } });
  };

  // ── Render ───────────────────────────────────────────────────

  // Steps 2 and 3 (generating + done) reuse existing styles
  if (effectivePhase === 'generating') {
    return (
      <>
        <style>{keyframes}</style>
        <div className="ctm-backdrop" onClick={closeCreate}>
          <div className="ctm-card" onClick={e => e.stopPropagation()}>
            <div className="ctm-centered">
              <div className="ctm-star">✦</div>
              <h2 className="ctm-load-title">Meridian is building options…</h2>
              <p className="ctm-load-sub">Searching flights, stays and experiences...</p>
              <div className="ctm-progress-wrap"><div className="ctm-progress-bar" /></div>
              <div className="ctm-checklist">
                <div className="ctm-check-item"><span className="ctm-check-icon">✓</span><span>Scanned flight routes</span></div>
                <div className="ctm-check-item"><span className="ctm-check-icon">✓</span><span>Matched stays & experiences</span></div>
                <div className="ctm-check-item"><div className="ctm-spinner" /><span>Curating your itinerary…</span></div>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  if (effectivePhase === 'done') {
    return (
      <>
        <style>{keyframes}</style>
        <div className="ctm-backdrop" onClick={closeCreate}>
          <div className="ctm-card" onClick={e => e.stopPropagation()}>
            <div className="ctm-centered">
              <div className="ctm-success-icon">✓</div>
              <h2 className="ctm-success-title">Trip created</h2>
              <p className="ctm-success-sub">3 itinerary options are ready for {travelerName}.</p>
              <div className="ctm-btn-row">
                <button className="ctm-btn-secondary" onClick={closeCreate}>Later</button>
                <button className="ctm-btn-primary" onClick={handleOpenCreatedTrip}>Open trip workspace</button>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{keyframes}</style>
      <div className="ctm-backdrop" onClick={closeCreate}>
        <div
          className={`ctm-card ctm-card--wide${(searchFocused || showCreateTraveler) ? ' ctm-card--dropdown-open' : ''}`}
          onClick={e => e.stopPropagation()}
        >

          {/* ── Customer selection ── */}
          {effectivePhase === 'customer' && (
            <>
              <div className="ctm-body">
                {createFromConvo && (
                  <div className="ctm-badge"><span>💬</span><span>Creating from {createFromConvo}'s chat</span></div>
                )}
                <h2 className="ctm-title">Who is this trip for?</h2>
                <p className="ctm-sub">Select a traveler from your client list, search to create a new one, or continue as a guest.</p>

                <div className="ctm-search-wrap">
                  <input
                    className="ctm-input ctm-search"
                    placeholder="Search by name or email…"
                    value={custSearch}
                    onChange={e => {
                      setCustSearch(e.target.value);
                      if (selectedCustomer) setSelectedCustomer(null);
                    }}
                    onFocus={() => setSearchFocused(true)}
                    onBlur={() => setTimeout(() => setSearchFocused(false), 150)}
                  />

                  {(searchFocused || showCreateTraveler) && (
                    <div className="ctm-customer-list">
                      {loadingCustomers && <div className="ctm-customer-empty">Loading clients…</div>}
                      {!loadingCustomers && filteredCustomers.length === 0 && custSearch && !showCreateTraveler && (
                        <div className="ctm-customer-empty">No clients found.</div>
                      )}
                      {!showCreateTraveler && filteredCustomers.slice(0, 6).map(c => {
                        const initials = `${c.first_name[0]}${c.last_name[0]}`.toUpperCase();
                        const isSelected = selectedCustomer?.customer_id === c.customer_id;
                        return (
                          <div
                            key={c.customer_id}
                            className={`ctm-customer-row${isSelected ? ' selected' : ''}`}
                            onMouseDown={e => e.preventDefault()}
                            onClick={() => {
                              setSelectedCustomer(c);
                              setIsGuest(false);
                              setCustSearch(`${c.first_name} ${c.last_name}`);
                              setSearchFocused(false);
                            }}
                          >
                            <div className="ctm-customer-avatar">{initials}</div>
                            <div className="ctm-customer-info">
                              <div className="ctm-customer-name">{c.first_name} {c.last_name}</div>
                              <div className="ctm-customer-email">{c.email ?? c.phone ?? ''}</div>
                            </div>
                            {isSelected && <span className="ctm-customer-check">✓</span>}
                          </div>
                        );
                      })}

                      {!loadingCustomers && custSearch.trim() && !showCreateTraveler && (
                        <div
                          className="ctm-customer-row"
                          onMouseDown={e => e.preventDefault()}
                          onClick={() => {
                            const [first, ...rest] = custSearch.trim().split(/\s+/);
                            setNewFirstName(first ?? '');
                            setNewLastName(rest.join(' '));
                            setCreateTravelerError('');
                            setShowCreateTraveler(true);
                          }}
                        >
                          <div className="ctm-customer-avatar ctm-guest-avatar">+</div>
                          <div className="ctm-customer-info">
                            <div className="ctm-customer-name">{`Create new traveler "${custSearch.trim()}"`}</div>
                            <div className="ctm-customer-email">Not in your client list yet</div>
                          </div>
                        </div>
                      )}

                      {showCreateTraveler && (
                        <div className="ctm-create-traveler-form">
                          {createTravelerError && <p className="ctm-create-traveler-error">{createTravelerError}</p>}
                          <input
                            className="ctm-input"
                            value={newFirstName}
                            onChange={e => setNewFirstName(e.target.value)}
                            placeholder="First name"
                            autoFocus
                          />
                          <input
                            className="ctm-input"
                            value={newLastName}
                            onChange={e => setNewLastName(e.target.value)}
                            placeholder="Last name"
                          />
                          <input
                            className="ctm-input"
                            value={newEmail}
                            onChange={e => setNewEmail(e.target.value)}
                            placeholder="Email (optional)"
                          />
                          <div className="ctm-create-traveler-actions">
                            <button type="button" className="ctm-btn-secondary" onClick={() => setShowCreateTraveler(false)}>
                              Cancel
                            </button>
                            <button
                              type="button"
                              className="ctm-btn-primary"
                              onClick={handleCreateTraveler}
                              disabled={creatingTraveler || !newFirstName.trim() || !newLastName.trim()}
                            >
                              {creatingTraveler ? 'Creating…' : 'Create traveler'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="ctm-or-divider"><span>or</span></div>

                <div className={`ctm-guest-row${isGuest ? ' selected' : ''}`} onClick={() => { setIsGuest(true); setSelectedCustomer(null); }}>
                  <div className="ctm-customer-avatar ctm-guest-avatar">?</div>
                  <div className="ctm-customer-info">
                    <div className="ctm-customer-name">Continue as guest</div>
                    <div className="ctm-customer-email">No client account needed</div>
                  </div>
                  {isGuest && <span className="ctm-customer-check">✓</span>}
                </div>

                {isGuest && (
                  <input
                    className="ctm-input"
                    style={{ marginTop: 10 }}
                    placeholder="Guest name (optional)"
                    value={guestName}
                    onChange={e => setGuestName(e.target.value)}
                    autoFocus
                  />
                )}
              </div>
              <div className="ctm-footer">
                <button className="ctm-btn-secondary" onClick={closeCreate}>Cancel</button>
                <button
                  className="ctm-btn-primary"
                  disabled={!selectedCustomer && !isGuest}
                  onClick={() => setPhase('mode')}
                >
                  Continue →
                </button>
              </div>
            </>
          )}

          {/* ── Mode selection ── */}
          {effectivePhase === 'mode' && (
            <>
              <div className="ctm-body">
                <h2 className="ctm-title">
                  Trip for <span style={{ color: '#2B63F6' }}>{travelerName}</span>
                </h2>
                <p className="ctm-sub">How would you like to build this trip?</p>
                <div className="ctm-mode-grid">
                  <button className="ctm-mode-card" onClick={() => setPhase('draft')}>
                    <div className="ctm-mode-icon">📋</div>
                    <div className="ctm-mode-label">Draft form</div>
                    <div className="ctm-mode-sub">Fill in trip details with structured fields. Good for precise inputs.</div>
                  </button>
                  <button className="ctm-mode-card ctm-mode-card--primary" onClick={() => setPhase('chat')}>
                    <div className="ctm-mode-icon">💬</div>
                    <div className="ctm-mode-label">Type or speak</div>
                    <div className="ctm-mode-sub">Describe the trip in your own words — or use your voice. Meridian extracts the details.</div>
                  </button>
                </div>
              </div>
              <div className="ctm-footer">
                <button className="ctm-btn-secondary" onClick={() => setPhase('customer')}>← Back</button>
              </div>
            </>
          )}

          {/* ── Draft mode ── */}
          {effectivePhase === 'draft' && (
            <>
              <div className="ctm-body">
                <h2 className="ctm-title">Trip details — <span style={{ color: '#2B63F6' }}>{travelerName}</span></h2>
                <div className="ctm-field-group">
                  <div className="ctm-field">
                    <span className="ctm-label">Trip name</span>
                    <input className="ctm-input" placeholder="e.g. Asante–Mensah Honeymoon" value={tripName} onChange={e => setTripName(e.target.value)} />
                  </div>
                  <div className="ctm-field">
                    <span className="ctm-label">Description / request</span>
                    <textarea className="ctm-input ctm-textarea" placeholder="e.g. 10-day honeymoon in early October…" rows={2} value={description} onChange={e => setDescription(e.target.value)} />
                  </div>

                  {/* Multi-city destinations */}
                  <div className="ctm-field">
                    <span className="ctm-label">Destinations</span>
                    <div className="ctm-dest-chips">
                      {destinations.map((d, i) => (
                        <span key={i} className="ctm-dest-chip">
                          {d}
                          <button onClick={() => setDestinations(prev => prev.filter((_, j) => j !== i))}>×</button>
                        </span>
                      ))}
                      {addingDest ? (
                        <input
                          className="ctm-dest-input"
                          placeholder="City or country…"
                          value={newDest}
                          autoFocus
                          onChange={e => setNewDest(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter' && newDest.trim()) {
                              setDestinations(prev => [...prev, newDest.trim()]);
                              setNewDest('');
                              setAddingDest(false);
                            }
                            if (e.key === 'Escape') { setNewDest(''); setAddingDest(false); }
                          }}
                          onBlur={() => {
                            if (newDest.trim()) setDestinations(prev => [...prev, newDest.trim()]);
                            setNewDest('');
                            setAddingDest(false);
                          }}
                        />
                      ) : (
                        <button className="ctm-dest-add" onClick={() => setAddingDest(true)}>+ Add city</button>
                      )}
                    </div>
                  </div>

                  <div className="ctm-field-row">
                    <div className="ctm-field">
                      <span className="ctm-label">Start date</span>
                      <input className="ctm-input" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
                    </div>
                    <div className="ctm-field">
                      <span className="ctm-label">End date</span>
                      <input className="ctm-input" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
                    </div>
                  </div>
                  <div className="ctm-field">
                    <span className="ctm-label">Budget (optional)</span>
                    <input className="ctm-input" placeholder="e.g. 8000" value={budget} onChange={e => setBudget(e.target.value)} />
                  </div>
                </div>
              </div>
              <div className="ctm-footer">
                <button className="ctm-btn-secondary" onClick={() => setPhase('mode')}>← Back</button>
                <button
                  className="ctm-btn-primary"
                  style={{ opacity: tripName.trim() ? 1 : 0.5 }}
                  disabled={!tripName.trim()}
                  onClick={handleDraftGenerate}
                >
                  ✦ Generate with Meridian
                </button>
              </div>
            </>
          )}

          {/* ── Chat mode ── */}
          {effectivePhase === 'chat' && (
            <>
              <div className="ctm-body ctm-chat-body">
                <div className="ctm-chat-header">
                  <h2 className="ctm-title" style={{ margin: 0 }}>
                    Planning for <span style={{ color: '#2B63F6' }}>{travelerName}</span>
                  </h2>
                </div>
                <div className="ctm-chat-thread">
                  {messages.map((msg, i) => (
                    <div key={i} className={`ctm-chat-msg ctm-chat-msg--${msg.role}`} style={{ animationDelay: `${i * 0.04}s` }}>
                      {msg.role === 'ai' && <div className="ctm-chat-ai-dot">✦</div>}
                      <div className="ctm-chat-bubble">{msg.text}</div>
                    </div>
                  ))}

                  {/* Show detected cities as chips after initial parse */}
                  {chatPhase !== 'initial' && chatDests.length > 0 && (
                    <div className="ctm-chat-parsed-row">
                      <span className="ctm-chat-parsed-label">Destinations detected:</span>
                      {chatDests.map((d, i) => <span key={i} className="ctm-dest-chip">{d}</span>)}
                      <button className="ctm-dest-add" onClick={() => {
                        const extra = prompt('Add another destination:');
                        if (extra?.trim()) setChatDests(prev => [...prev, extra.trim()]);
                      }}>+ Add</button>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>
              </div>

              {chatPhase === 'confirm' ? (
                <div className="ctm-confirm-actions">
                  <p className="ctm-confirm-hint">Ready to create <strong>{chatTripName}</strong>{chatDests.length ? ` — ${chatDests.join(' → ')}` : ''}{chatBudget ? ` · Budget ${chatBudget}` : ''}</p>
                  <div className="ctm-confirm-btns">
                    <button className="ctm-btn-secondary" onClick={() => {
                      setMessages(prev => [...prev, { role: 'agent', text: 'Start over' }, { role: 'ai', text: 'No problem — describe the trip again and I\'ll start fresh.' }]);
                      setChatPhase('initial');
                      setChatTripName('');
                      setChatDests([]);
                      setChatBudget('');
                    }}>
                      Start over
                    </button>
                    <button className="ctm-btn-primary" onClick={() => {
                      setMessages(prev => [...prev, { role: 'agent', text: 'Yes, create trip' }, { role: 'ai', text: 'Creating the trip now…' }]);
                      const descParts = [
                        `Chat request: ${messages.find(m => m.role === 'agent')?.text ?? ''}`,
                        chatDests.length ? `Destinations: ${chatDests.join(', ')}` : '',
                      ].filter(Boolean);
                      createTrip(chatTripName, descParts.join('\n'), undefined, undefined, chatBudget);
                    }}>
                      Yes, create trip →
                    </button>
                  </div>
                </div>
              ) : (
                <div className="ctm-chat-input-area">
                  <textarea
                    className="ctm-chat-textarea"
                    placeholder="Describe the trip…"
                    value={chatDraft}
                    onChange={e => setChatDraft(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleChatSend(); } }}
                    rows={2}
                  />
                  <div className="ctm-chat-input-btns">
                    {hasSpeech && (
                      <button
                        className={`ctm-voice-btn${recording ? ' ctm-voice-btn--active' : ''}`}
                        onClick={toggleVoice}
                        title={recording ? 'Stop recording' : 'Speak your request'}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                          <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                          <line x1="12" y1="19" x2="12" y2="23"/>
                          <line x1="8" y1="23" x2="16" y2="23"/>
                        </svg>
                        {recording ? 'Stop' : 'Speak'}
                      </button>
                    )}
                    <button className="ctm-btn-primary" onClick={handleChatSend} disabled={!chatDraft.trim()}>
                      Send →
                    </button>
                  </div>
                </div>
              )}

              <div className="ctm-footer ctm-footer--borderless">
                <button className="ctm-btn-secondary" onClick={() => setPhase('mode')}>← Back</button>
              </div>
            </>
          )}

        </div>
      </div>
    </>
  );
}
