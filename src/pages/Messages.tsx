import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApp } from '../contexts/AppContext'
import { ApiService } from '../services/api-service'
import type { Conversation, Message, ConversationResponse, SuggestedReply } from '../types/app'
import LinkTripModal from '../components/modals/LinkTripModal'
import AddGmailThreadModal from '../components/modals/AddGmailThreadModal'
import '../styles/Messages.css';

// ── Messages ───────────────────────────────────────────────────
// Purpose: Three-panel messaging inbox — conversation list (left),
//          chat view (center), linked trip / action points (right).
//          On mobile, single-panel with navigation (inbox/chat/details).
// State: convoId from URL params (a real conversation_id, not an array index — the list can
//        reorder as new mail arrives); active conversation derived; mobilePanel state; the
//        active thread's full message list, fetched on demand once a conversation is opened
//        (the list endpoint only carries a preview, see ConversationController::index);
//        channelFilter for the All/WhatsApp/Gmail pills; the compose box's draft text + sending
//        state; AI suggestions (only fetched when the agent clicks "Suggest reply").
// API: ctx.fetchConversationsList() (list, on mount) / ApiService.getConversation() (thread,
//      per-selection) — both real, backed by explicitly-tracked Gmail threads (see
//      AddGmailThreadModal — nothing syncs automatically, an agent opts each thread in).
//      ApiService.sendConversationMessage() sends a real reply through the connected Gmail
//      account; ApiService.suggestReply() asks meridian-ai for draft options on demand.

type ChannelFilter = 'all' | 'whatsapp' | 'gmail';
const filterPills: { key: ChannelFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'whatsapp', label: 'WhatsApp' },
  { key: 'gmail', label: 'Gmail' },
];

export default function Messages() {
  const { convoId } = useParams<{ convoId: string }>();
  const navigate = useNavigate();
  const ctx = useApp();
  const allConversations = ctx.getConversations();
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>('all');
  const conversations = channelFilter === 'all' ? allConversations : allConversations.filter(c => c.ch === channelFilter);
  const activeConvo = convoId
    ? conversations.find(c => c.conversation_id === convoId) ?? null
    : conversations[0] ?? null;

  const [mobilePanel, setMobilePanel] = useState<'inbox' | 'chat' | 'details'>(
    activeConvo ? 'chat' : 'inbox'
  );
  const [loadingList, setLoadingList] = useState(true);
  const [activeMessages, setActiveMessages] = useState<Message[] | null>(null);
  const [loadingThread, setLoadingThread] = useState(false);
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [suggestions, setSuggestions] = useState<SuggestedReply[] | null>(null);
  const [suggestLoading, setSuggestLoading] = useState(false);

  useEffect(() => {
    ctx.fetchConversationsList().finally(() => setLoadingList(false));
    // Only meant to run once on mount — fetchConversationsList is stable (useCallback).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeId = activeConvo?.conversation_id ?? null;
  useEffect(() => {
    setReplyText('');
    setSuggestions(null);
    if (!activeId) { setActiveMessages(null); return; }
    setLoadingThread(true);
    ApiService.getConversation(activeId)
      .then(full => setActiveMessages(ctx.reshapeMessages(full.messages ?? [])))
      .catch(() => setActiveMessages([]))
      .finally(() => setLoadingThread(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  // Sends the compose box's text as a real reply, then reloads the thread so it appears
  // immediately (same fetch the initial load uses — simplest way to get correct ordering).
  const handleSend = async () => {
    const body = replyText.trim();
    if (!activeId || !body || sending) return;
    setSending(true);
    try {
      await ApiService.sendConversationMessage(activeId, body);
      setReplyText('');
      setSuggestions(null);
      const full = await ApiService.getConversation(activeId);
      setActiveMessages(ctx.reshapeMessages(full.messages ?? []));
      ctx.fetchConversationsList();
    } catch (err) {
      ctx.toastAction(err instanceof Error ? err.message : 'Failed to send your reply');
    } finally {
      setSending(false);
    }
  };

  // Asks meridian-ai for draft of email requesting missing travel details — only runs when the agent clicks "Suggest reply".
  const handleRequestTravelDetails = async () => {
    if (!activeId || suggestLoading) return;
    setSuggestLoading(true);
    try {
      const res = await ApiService.requestTravelDetails(activeId);
      setSuggestions(res.suggestions);
    } catch (err) {
      ctx.toastAction(err instanceof Error ? err.message : 'Failed to draft a suggestion');
    } finally {
      setSuggestLoading(false);
    }
  };

  // Asks meridian-ai for draft suggestions — only runs when the agent clicks "Suggest reply".
  const handleSuggestReply = async () => {
    if (!activeId || suggestLoading) return;
    setSuggestLoading(true);
    try {
      const res = await ApiService.suggestReply(activeId);
      setSuggestions(res.suggestions);
    } catch (err) {
      ctx.toastAction(err instanceof Error ? err.message : 'Failed to draft a suggestion');
    } finally {
      setSuggestLoading(false);
    }
  };

  // Loads a suggestion into the compose box — doesn't auto-send, sending stays an explicit step.
  const handleUseSuggestion = (text: string) => setReplyText(text);

  const convos = conversations.map((c) => ({
    ...c,
    onClick: () => {
      if (c.conversation_id) navigate(`/app/messages/${c.conversation_id}`);
      setMobilePanel('chat');
    },
  }));

  // A thread was just added via the picker — refresh the list and jump straight to it so the
  // agent can immediately link it to a trip (RightPanel's existing flow, nothing new needed).
  const handleThreadAdded = (conversation: ConversationResponse) => {
    ctx.fetchConversationsList();
    setChannelFilter('all');
    navigate(`/app/messages/${conversation.conversation_id}`);
    setMobilePanel('chat');
  };

  // Untrack — removes this conversation from Meridian only (the source email is untouched).
  const handleUntrack = async () => {
    if (!activeId) return;
    if (!window.confirm('Stop tracking this conversation in Meridian? Its messages will be removed here — the email itself is unaffected, and you can re-add the thread later.')) {
      return;
    }
    await ApiService.untrackConversation(activeId);
    navigate('/app/messages');
    setMobilePanel('inbox');
    ctx.fetchConversationsList();
  };

  return (
    <div className="msgs-page">
      <div className="msgs-layout" data-mobile-panel={mobilePanel}>
        {loadingList ? (
          <div className="msgs-center-empty">Loading conversations…</div>
        ) : (
          <>
            <LeftPanel
              convos={convos}
              activeConvo={activeId}
              channelFilter={channelFilter}
              onFilterChange={setChannelFilter}
              onSelectConvo={() => setMobilePanel('chat')}
              onOpenAddModal={() => setAddModalOpen(true)}
            />
            <CenterPanel
              convo={activeConvo}
              messages={activeMessages}
              loadingThread={loadingThread}
              onBack={() => setMobilePanel('inbox')}
              onShowDetails={() => setMobilePanel('details')}
              onUntrack={handleUntrack}
              replyText={replyText}
              onReplyTextChange={setReplyText}
              sending={sending}
              onSend={handleSend}
              suggestions={suggestions}
              suggestLoading={suggestLoading}
              onSuggestReply={handleSuggestReply}
              onRequestTravelDetails={handleRequestTravelDetails}
              onUseSuggestion={handleUseSuggestion}
            />
            <RightPanel
              convo={activeConvo}
              onBack={() => setMobilePanel('chat')}
              onOpenLinkModal={() => setLinkModalOpen(true)}
            />
          </>
        )}
      </div>
      <LinkTripModal
        open={linkModalOpen}
        conversationId={activeId}
        onClose={() => setLinkModalOpen(false)}
        onLinked={() => ctx.fetchConversationsList()}
      />
      <AddGmailThreadModal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onAdded={handleThreadAdded}
      />
    </div>
  )
}

function LeftPanel({ convos, activeConvo, channelFilter, onFilterChange, onSelectConvo, onOpenAddModal }: {
  convos: Conversation[];
  activeConvo: string | null;
  channelFilter: ChannelFilter;
  onFilterChange: (f: ChannelFilter) => void;
  onSelectConvo: () => void;
  onOpenAddModal: () => void;
}) {
  return (
    <div className="msgs-left-panel">
      <div className="msgs-left-header">
        <div className="msgs-left-header-row">
          <h2 className="msgs-inbox-heading">Inbox</h2>
          <button className="msgs-add-thread-btn" onClick={onOpenAddModal}>+ Add</button>
        </div>
        <div className="msgs-filter-row">
          {filterPills.map((p) => (
            <span
              key={p.key}
              onClick={() => onFilterChange(p.key)}
              className={`msgs-filter-pill ${channelFilter === p.key ? 'msgs-filter-pill-active' : 'msgs-filter-pill-inactive'}`}
            >{p.label}</span>
          ))}
        </div>
      </div>
      <div className="msgs-convo-list">
        {convos.length === 0 && (
          <div className="msgs-center-empty" style={{ height: 'auto', padding: '32px 16px' }}>
            {channelFilter === 'gmail'
              ? 'No Gmail threads tracked yet. Click "+ Add" to pick some from your inbox.'
              : channelFilter === 'whatsapp'
              ? 'WhatsApp isn’t connected yet.'
              : 'No conversations yet. Click "+ Add" to pull in a Gmail thread.'}
          </div>
        )}
        {convos.map((c) => {
          const active = !!c.conversation_id && c.conversation_id === activeConvo
          return (
            <div key={c.conversation_id} onClick={() => { c.onClick?.(); onSelectConvo(); }}
              className={`msgs-convo-row${active ? ' msgs-convo-row-active' : ''}`}
              style={{ background: !active ? (c.rowBg || 'transparent') : undefined }}
            >
              <div className="msgs-avatar-wrapper">
                <div className="msgs-avatar" style={{ background: c.avBg }}>{c.av}</div>
                <div className="msgs-ch-icon">{c.chIcon}</div>
              </div>
              <div className="msgs-convo-body">
                <div className="msgs-convo-top">
                  <span className="msgs-convo-name">{c.name}</span>
                  <span className="msgs-convo-time">{c.time}</span>
                </div>
                <div className="msgs-convo-last" style={{
                  color: c.unread > 0 ? '#15161B' : '#8A90A2',
                  fontWeight: c.unread > 0 ? 500 : 400,
                }}>{c.last}</div>
              </div>
              {c.unread > 0 && (
                <div className="msgs-unread-badge">{c.unread}</div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function CenterPanel({
  convo, messages, loadingThread, onBack, onShowDetails, onUntrack,
  replyText, onReplyTextChange, sending, onSend,
  suggestions, suggestLoading, onSuggestReply, onRequestTravelDetails, onUseSuggestion,
}: {
  convo: Conversation | null;
  messages: Message[] | null;
  loadingThread: boolean;
  onBack: () => void;
  onShowDetails: () => void;
  onUntrack: () => void;
  replyText: string;
  onReplyTextChange: (text: string) => void;
  sending: boolean;
  onSend: () => void;
  suggestions: SuggestedReply[] | null;
  suggestLoading: boolean;
  onSuggestReply: () => void;
  onRequestTravelDetails: () => void;
  onUseSuggestion: (text: string) => void;
}) {
  const navigate = useNavigate();
  if (!convo) {
    return (
      <div className="msgs-center-empty">
        Select a conversation
      </div>
    )
  }

  return (
    <div className="msgs-center-panel">
      <div className="msgs-chat-header">
        <div className="msgs-chat-header-left">
          <button onClick={onBack} className="msgs-back-btn" aria-label="Back to inbox">&larr;</button>
          <div className="msgs-avatar-wrapper">
            <div className="msgs-avatar" style={{ background: convo.avBg }}>{convo.av}</div>
            <div className="msgs-ch-icon">{convo.chIcon}</div>
          </div>
          <div>
            <div className="msgs-chat-name">{convo.name}</div>
            <div className="msgs-chat-sub">
              via {convo.ch === 'whatsapp' ? 'WhatsApp' : convo.ch === 'gmail' ? 'Gmail' : 'Instagram'} · {convo.linkLabel}
            </div>
          </div>
        </div>
        <div className="msgs-chat-header-right">
          {convo.hasTrip && convo.trip ? (
            <button onClick={() => navigate(`/app/trips/${convo.trip}`)} className="msgs-open-trip-btn">
              Open trip &nbsp;↗
            </button>
          ) : null}
          <button onClick={onUntrack} className="msgs-untrack-btn" title="Stop tracking this conversation in Meridian">Untrack</button>
          <button onClick={onShowDetails} className="msgs-details-btn" aria-label="Show details">⋮</button>
        </div>
      </div>

      <div className="msgs-msgs-area">
        {loadingThread ? (
          <div className="msgs-center-empty" style={{ height: 'auto', padding: '32px 0' }}>Loading messages…</div>
        ) : !messages || messages.length === 0 ? (
          <div className="msgs-center-empty" style={{ height: 'auto', padding: '32px 0' }}>No messages in this thread.</div>
        ) : messages.map((m, i) => (
          <div key={i} className="msgs-msg-row" style={{
            justifyContent: m.align || (m.me ? 'flex-end' : 'flex-start'),
          }}>
            <div className="msgs-bubble" style={{
              background: m.bubbleBg || (m.me ? '#2B63F6' : '#fff'),
              color: m.bubbleFg || (m.me ? '#fff' : '#15161B'),
              border: m.bubbleBorder || (m.me ? 'none' : '1px solid #ECEDF2'),
              textAlign: (m.textAlign || (m.me ? 'right' : 'left')) as React.CSSProperties['textAlign'],
            }}>
              <div>{m.t}</div>
              <div className="msgs-bubble-time" style={{
                color: m.me ? 'rgba(255,255,255,0.7)' : '#AEB3C2',
              }}>{m.time}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="msgs-draft-bar">
        <div className="msgs-draft-header">
          <span className="msgs-draft-label">AI suggested replies</span>
          <button className="msgs-suggest-btn" onClick={onRequestTravelDetails} disabled={suggestLoading}>
            {suggestLoading ? 'Drafting…' : 'Draft request for more details'}
          </button>
          <button className="msgs-suggest-btn" onClick={onSuggestReply} disabled={suggestLoading}>
            {suggestLoading ? 'Drafting…' : 'Suggest reply'}
          </button>
        </div>
        {suggestions && suggestions.length > 0 && (
          <div className="msgs-suggestions-list">
            {suggestions.map((s, i) => (
              <div key={i} className="msgs-suggestion-card">
                <div className="msgs-draft-text">
                  <span className="msgs-suggestion-tone">{s.tone}</span> {s.text}
                </div>
                <button className="msgs-use-btn" onClick={() => onUseSuggestion(s.text)}>Use</button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="msgs-input-bar">
        <input
          placeholder="Type a reply…"
          className="msgs-input"
          value={replyText}
          onChange={(e) => onReplyTextChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend(); } }}
          disabled={sending}
        />
        <button className="msgs-send-btn" onClick={onSend} disabled={sending || !replyText.trim()}>
          {sending ? '…' : '➤'}
        </button>
      </div>
    </div>
  )
}

function RightPanel({ convo, onBack, onOpenLinkModal }: { convo: Conversation | null; onBack: () => void; onOpenLinkModal: () => void }) {
  const ctx = useApp();
  if (!convo) {
    return <div className="msgs-right-empty" />
  }

  if (convo.hasTrip) {
    return (
      <div className="msgs-right-panel">
        <button onClick={onBack} className="msgs-back-btn msgs-back-btn-details" aria-label="Back to chat">&larr; Back</button>
        <div className="msgs-trip-card" style={{
          background: convo.tripGradient || 'linear-gradient(135deg,#1B5BBE,#5AA0FF)',
        }}>
          <div className="msgs-trip-card-label">Linked trip</div>
          <div className="msgs-trip-card-name">{convo.linkName || convo.name}</div>
          <div className="msgs-trip-card-row">
            <span className="msgs-status-badge" style={{
              background: convo.tripStatusBg || '#EEF0F4',
              color: convo.tripStatusFg || '#5B6172',
            }}>{convo.tripStatus || 'In progress'}</span>
            <span className="msgs-trip-value">{convo.tripValue || ''}</span>
          </div>
        </div>

        <div className="msgs-discovery-card">
          <div className="msgs-discovery-heading">
            From the discovery call
          </div>
          <div className="msgs-discovery-text">
            {convo.summary}
          </div>
        </div>

        <div>
          <div className="msgs-action-title">
            Action points
          </div>
          {[
            'Send itinerary options',
            'Confirm dietary needs',
            'Quote travel insurance',
          ].map((a, i) => (
            <div key={i} className="msgs-action-row">
              <div className="msgs-action-checkbox" />
              <span className="msgs-action-text">{a}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="msgs-right-panel">
      <div className="msgs-no-trip">
        <div className="msgs-no-trip-title">
          No trip yet
        </div>
        <div className="msgs-no-trip-desc">
          Turn this chat into a structured trip workspace, or link it to a trip that already exists.
        </div>
      </div>

      <div className="msgs-create-card">
        <div className="msgs-create-card-title">
          Turn this chat into a trip
        </div>
        <div className="msgs-create-card-desc">
          Create a trip from this conversation and Meridian will extract the brief and draft itinerary options.
        </div>
        <button onClick={() => ctx.createTripFromConvo(convo.name)} className="msgs-create-btn">
          Create trip from this chat
        </button>
        <button onClick={onOpenLinkModal} className="msgs-create-btn-secondary">
          Link to an existing trip
        </button>
      </div>

      <div className="msgs-noticed-card">
        <div className="msgs-noticed-heading">
          Meridian noticed
        </div>
        <div className="msgs-noticed-text">
          {convo.summary}
        </div>
      </div>
    </div>
  )
}
