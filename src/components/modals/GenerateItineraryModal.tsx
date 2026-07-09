import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../contexts/AppContext';
import type { TripItem } from '../../types/app';
import { MERIDIAN_AI_PROVIDER_KEY } from '../../pages/Settings';
import '../../styles/GenerateItineraryModal.css';

type GenStep = 'pick' | 'questions';
type PrefMode = 'form' | 'chat';
type RecordingField = 'notes' | 'requirements' | 'chat' | null;

const AI_MODELS = [
  { id: '',           label: 'Auto (recommended)',    sub: 'Best available model' },
  { id: 'gemini',     label: 'Gemini 2.5 Flash Lite', sub: 'Google — free tier' },
  { id: 'openai',     label: 'GPT-4o Mini',           sub: 'OpenAI' },
  { id: 'anthropic',  label: 'Claude Haiku',          sub: 'Anthropic' },
];

const priorityOptions = ['Flights', 'Accommodation', 'Activities', 'Dining', 'Experiences'];

// This modal collects trip + preferences then navigates to TripDetail with
// { triggerGenerate: true, travelerPrefs } — TripDetail calls the API.
export default function GenerateItineraryModal() {
  const navigate = useNavigate();
  const { genItinOpen, closeGenItin, openCreate, getTripsData, fetchTripsList } = useApp();

  const [step, setStep] = useState<GenStep>('pick');
  const [prefMode, setPrefMode] = useState<PrefMode>('form');
  const [chatInput, setChatInput] = useState('');
  const [chatThread, setChatThread] = useState<{ role: 'agent' | 'ai'; text: string }[]>([]);
  const [voiceMode, setVoiceMode] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const ttsRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    if (genItinOpen) fetchTripsList();
  }, [genItinOpen, fetchTripsList]);

  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [budget, setBudget] = useState('');
  const [style, setStyle] = useState('');
  const [priorities, setPriorities] = useState<string[]>([]);
  const [startCity, setStartCity] = useState('');
  const [preferredAirlines, setPreferredAirlines] = useState('');
  const [specialRequirements, setSpecialRequirements] = useState('');
  const [notes, setNotes] = useState('');
  const [aiProvider, setAiProvider] = useState(() => localStorage.getItem(MERIDIAN_AI_PROVIDER_KEY) ?? '');

  const [recording, setRecording] = useState<RecordingField>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);

  if (!genItinOpen) return null;

  const hasSpeech =
    typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  const startVoice = (field: RecordingField) => {
    if (!hasSpeech) return;

    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
      if (recording === field) { setRecording(null); return; }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = Array.from(event.results)
        .map((r: SpeechRecognitionResult) => r[0].transcript)
        .join(' ')
        .trim();
      if (field === 'notes') setNotes(prev => prev ? `${prev} ${transcript}` : transcript);
      if (field === 'requirements') setSpecialRequirements(prev => prev ? `${prev} ${transcript}` : transcript);
      if (field === 'chat') setChatInput(prev => prev ? `${prev} ${transcript}` : transcript);
    };

    recognition.onend = () => { setRecording(null); recognitionRef.current = null; };
    recognition.onerror = () => { setRecording(null); recognitionRef.current = null; };

    recognitionRef.current = recognition;
    recognition.start();
    setRecording(field);
  };

  const trips = getTripsData().filter(t => t.status === 'Draft' || t.status === 'AI drafting');

  const handleSelectTrip = (idx: number) => {
    setSelectedIdx(idx);
    setStep('questions');
    setChatThread([{ role: 'ai', text: `Ready to plan the trip. Describe what you need — destinations, budget, style, airlines, dates, or anything else that matters.` }]);
  };
  const handleCreateTrip = () => { closeGenItin(); openCreate(); };
  const handleBack = () => { setStep('pick'); setChatThread([]); };

  const speakText = useCallback((text: string) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.rate = 1.05;
    ttsRef.current = utt;
    window.speechSynthesis.speak(utt);
  }, []);

  const stopTts = () => {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  };

  const sendChatMessage = useCallback(() => {
    const text = chatInput.trim();
    if (!text) return;
    const agentMsg = { role: 'agent' as const, text };
    const aiReply = { role: 'ai' as const, text: `Got it — I'll use that when generating. Anything else to add, or shall we generate now?` };
    setChatThread(prev => [...prev, agentMsg, aiReply]);
    setChatInput('');
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 60);
    if (voiceMode) speakText(aiReply.text);
  }, [chatInput, voiceMode, speakText]);

  const handleGenerate = () => {
    if (selectedIdx === null) return;
    if (recognitionRef.current) recognitionRef.current.stop();

    const trip = getTripsData()[selectedIdx];
    const destination = trip?.id ?? selectedIdx;

    const combinedNotes = prefMode === 'chat'
      ? chatThread.filter(m => m.role === 'agent').map(m => m.text).join('\n')
        + (chatInput.trim() ? '\n' + chatInput.trim() : '')
      : [
          specialRequirements ? `Special requirements: ${specialRequirements}` : '',
          preferredAirlines ? `Preferred airlines: ${preferredAirlines}` : '',
          notes,
        ].filter(Boolean).join('\n');

    closeGenItin();
    navigate(`/app/trips/${destination}`, {
      state: {
        triggerGenerate: true,
        travelerPrefs: {
          budget: budget || undefined,
          style: style || undefined,
          priorities: priorities.length ? priorities : undefined,
          notes: combinedNotes || undefined,
          start_city: startCity || undefined,
          provider: aiProvider || undefined,
        },
      },
    });
  };

  const togglePriority = (opt: string) =>
    setPriorities(prev => prev.includes(opt) ? prev.filter(p => p !== opt) : [...prev, opt]);

  const selected = selectedIdx !== null ? getTripsData()[selectedIdx] : null;

  const MicIcon = ({ active }: { active: boolean }) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke={active ? '#fff' : 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
      <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
      <line x1="12" y1="19" x2="12" y2="23"/>
      <line x1="8" y1="23" x2="16" y2="23"/>
    </svg>
  );

  return (
    <div className="gim-backdrop" onClick={closeGenItin}>
      <div className={`gim-card${step === 'questions' && prefMode === 'chat' ? ' gim-card--chat' : ''}`} onClick={e => e.stopPropagation()}>

        <div className="gim-header">
          {step === 'pick' ? (
            <>
              <h2 className="gim-title">Generate itinerary</h2>
              <p className="gim-sub">Select a trip to generate options for, or create a new one.</p>
            </>
          ) : (
            <>
              <h2 className="gim-title">Traveler preferences</h2>
              <p className="gim-sub">Fill in the details below to get the best itinerary options.</p>
            </>
          )}
          <div className="gim-step-indicator">
            <div className={'gim-step-dot' + (step === 'pick' ? ' active' : '')} />
            <div className={'gim-step-dot' + (step === 'questions' ? ' active' : '')} />
          </div>
        </div>

        {/* ── Step 1: Trip picker ── */}
        {step === 'pick' && (
          <>
            {trips.length > 0 && (
              <div className="gim-section-label">Existing trips ({trips.length})</div>
            )}
            <div className="gim-trip-list">
              {trips.length === 0 ? (
                <div className="gim-empty">No draft trips yet. Start by creating a new trip.</div>
              ) : (
                trips.map((t: TripItem) => {
                  const idx = getTripsData().indexOf(t);
                  return (
                    <div key={t.name} className="gim-trip-item" onClick={() => handleSelectTrip(idx)}>
                      <div className="gim-trip-avatar" style={{ background: t.cover }}>{t.initials}</div>
                      <div className="gim-trip-info">
                        <div className="gim-trip-name">{t.name}</div>
                        <div className="gim-trip-meta">{t.traveler} · {t.where} · {t.dates}</div>
                      </div>
                      <div className="gim-trip-status" style={{ background: t.statusBg, color: t.statusFg }}>
                        {t.status}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            <button className="gim-create-btn" onClick={handleCreateTrip}>
              <span className="gim-create-icon">+</span>
              Create a new trip
            </button>
            <div className="gim-footer">
              <button className="gim-cancel-btn" onClick={closeGenItin}>Cancel</button>
            </div>
          </>
        )}

        {/* ── Step 2: Preferences ── */}
        {step === 'questions' && selected && (
          <>
            <div className="gim-selected-trip-info">
              <div className="gim-selected-trip-avatar" style={{ background: selected.cover }}>
                {selected.initials}
              </div>
              <div className="gim-selected-trip-name">{selected.name}</div>
              {/* Mode toggle */}
              <div className="gim-mode-toggle">
                <button className={`gim-mode-btn${prefMode === 'form' ? ' active' : ''}`} onClick={() => setPrefMode('form')}>
                  Form
                </button>
                <button className={`gim-mode-btn${prefMode === 'chat' ? ' active' : ''}`} onClick={() => setPrefMode('chat')}>
                  ✦ Chat
                </button>
              </div>
            </div>

            {/* ── Chat mode ── */}
            {prefMode === 'chat' && (
              <div className="gim-chat-mode">
                <div className="gim-chat-thread">
                  {chatThread.map((msg, i) => (
                    <div key={i} className={`gim-thread-msg gim-thread-msg--${msg.role}`}>
                      {msg.role === 'ai' && <div className="gim-thread-avatar">✦</div>}
                      <div className="gim-thread-bubble">
                        {msg.text}
                        {msg.role === 'ai' && (
                          <button
                            className="gim-thread-speak-btn"
                            onClick={() => speakText(msg.text)}
                            title="Read aloud"
                          >🔊</button>
                        )}
                      </div>
                    </div>
                  ))}
                  <div ref={chatEndRef} />
                </div>

                <div className="gim-chat-input-wrap">
                  <textarea
                    className={'gim-chat-textarea' + (recording === 'chat' ? ' listening' : '')}
                    placeholder="Describe the trip requirements…"
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChatMessage(); } }}
                    rows={2}
                  />
                  <div className="gim-chat-input-bar">
                    <div className="gim-model-pills gim-model-pills--compact">
                      {AI_MODELS.map(m => (
                        <button key={m.id} type="button" className={'gim-model-pill' + (aiProvider === m.id ? ' selected' : '')} onClick={() => setAiProvider(m.id)}>
                          <span className="gim-model-pill-label">{m.label}</span>
                        </button>
                      ))}
                    </div>
                    <div className="gim-chat-input-actions">
                      {hasSpeech && (
                        <>
                          <button
                            type="button"
                            className={'gim-voice-btn' + (recording === 'chat' ? ' recording' : '')}
                            onClick={() => { setVoiceMode(true); startVoice('chat'); }}
                            title="Voice input"
                          >
                            <MicIcon active={recording === 'chat'} />
                            {recording === 'chat' ? 'Stop' : 'Voice'}
                          </button>
                          <button
                            type="button"
                            className="gim-voice-btn"
                            onClick={stopTts}
                            title="Stop speaking"
                          >🔇</button>
                        </>
                      )}
                      <button
                        type="button"
                        className="gim-chat-send-btn"
                        onClick={sendChatMessage}
                        disabled={!chatInput.trim()}
                      >
                        Send ↵
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── Form mode ── */}
            {prefMode === 'form' && (
            <div className="gim-questions">

              {/* AI model picker */}
              <div className="gim-q-group">
                <label className="gim-q-label">AI model</label>
                <div className="gim-model-pills">
                  {AI_MODELS.map(m => (
                    <button
                      key={m.id}
                      type="button"
                      className={'gim-model-pill' + (aiProvider === m.id ? ' selected' : '')}
                      onClick={() => setAiProvider(m.id)}
                    >
                      <span className="gim-model-pill-label">{m.label}</span>
                      <span className="gim-model-pill-sub">{m.sub}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Budget + Style */}
              <div className="gim-q-row">
                <div className="gim-q-group gim-q-half">
                  <label className="gim-q-label">Budget range</label>
                  <select className="gim-q-select" value={budget} onChange={e => setBudget(e.target.value)}>
                    <option value="">Select budget…</option>
                    <option value="Budget">Budget (under $1,000)</option>
                    <option value="Mid-range">Mid-range ($1,000 – $5,000)</option>
                    <option value="Luxury">Luxury ($5,000+)</option>
                    <option value="Ultra-luxury">Ultra-luxury ($20,000+)</option>
                    <option value="No preference">No preference</option>
                  </select>
                </div>
                <div className="gim-q-group gim-q-half">
                  <label className="gim-q-label">Travel style</label>
                  <select className="gim-q-select" value={style} onChange={e => setStyle(e.target.value)}>
                    <option value="">Select style…</option>
                    <option value="Adventure">Adventure</option>
                    <option value="Relaxation">Relaxation</option>
                    <option value="Cultural">Cultural</option>
                    <option value="Business">Business</option>
                    <option value="Family">Family</option>
                    <option value="Mixed">Mixed</option>
                  </select>
                </div>
              </div>

              {/* Key priorities */}
              <div className="gim-q-group">
                <label className="gim-q-label">Key priorities <span className="gim-q-label-hint">(select all that apply)</span></label>
                <div className="gim-q-checks">
                  {priorityOptions.map(o => (
                    <label key={o} className={'gim-q-check-item' + (priorities.includes(o) ? ' checked' : '')}>
                      <input
                        type="checkbox"
                        checked={priorities.includes(o)}
                        onChange={() => togglePriority(o)}
                      />
                      <span>{o}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Departure city + Airlines */}
              <div className="gim-q-row">
                <div className="gim-q-group gim-q-half">
                  <label className="gim-q-label">Departure city</label>
                  <input
                    type="text"
                    className="gim-q-input"
                    placeholder="e.g. Accra, London…"
                    value={startCity}
                    onChange={e => setStartCity(e.target.value)}
                  />
                </div>
                <div className="gim-q-group gim-q-half">
                  <label className="gim-q-label">Preferred airlines</label>
                  <input
                    type="text"
                    className="gim-q-input"
                    placeholder="e.g. Emirates, KLM…"
                    value={preferredAirlines}
                    onChange={e => setPreferredAirlines(e.target.value)}
                  />
                </div>
              </div>

              {/* Special requirements */}
              <div className="gim-q-group">
                <div className="gim-q-label-row">
                  <label className="gim-q-label">Special requirements</label>
                  {hasSpeech && (
                    <button
                      type="button"
                      className={'gim-voice-btn' + (recording === 'requirements' ? ' recording' : '')}
                      onClick={() => startVoice('requirements')}
                      title={recording === 'requirements' ? 'Stop dictation' : 'Dictate via microphone'}
                    >
                      <MicIcon active={recording === 'requirements'} />
                      {recording === 'requirements' ? 'Stop' : 'Dictate'}
                    </button>
                  )}
                </div>
                <textarea
                  className={'gim-q-textarea' + (recording === 'requirements' ? ' listening' : '')}
                  placeholder="Dietary needs, accessibility, medical notes, visa requirements…"
                  value={specialRequirements}
                  onChange={e => setSpecialRequirements(e.target.value)}
                />
              </div>

              {/* Additional notes */}
              <div className="gim-q-group">
                <div className="gim-q-label-row">
                  <label className="gim-q-label">Additional notes</label>
                  {hasSpeech && (
                    <button
                      type="button"
                      className={'gim-voice-btn' + (recording === 'notes' ? ' recording' : '')}
                      onClick={() => startVoice('notes')}
                      title={recording === 'notes' ? 'Stop dictation' : 'Dictate via microphone'}
                    >
                      <MicIcon active={recording === 'notes'} />
                      {recording === 'notes' ? 'Stop' : 'Dictate'}
                    </button>
                  )}
                </div>
                <textarea
                  className={'gim-q-textarea' + (recording === 'notes' ? ' listening' : '')}
                  placeholder="Any other preferences, must-see places, or details for the AI…"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                />
              </div>

            </div>
            )} {/* end form mode */}

            <div className="gim-footer">
              <button className="gim-back-btn" onClick={handleBack}>Back</button>
              <button
                className="gim-next-btn"
                onClick={handleGenerate}
                disabled={prefMode === 'chat' && !chatInput.trim()}
              >
                Generate itinerary
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
