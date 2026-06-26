import { useParams, useNavigate } from 'react-router-dom';
import { useApp } from '../contexts/AppContext'
import '../styles/Messages.css';

const filterPills = ['All', '\uD83D\uDCAC WhatsApp', '\u2709\uFE0F']

export default function Messages() {
  const { convoId } = useParams<{ convoId: string }>();
  const navigate = useNavigate();
  const ctx = useApp();
  const conversations = ctx.getConversations();
  const activeIdx = convoId ? parseInt(convoId, 10) : 0;
  const activeConvo = conversations[activeIdx] ?? null;

  const convos = conversations.map((c, i) => ({
    ...c,
    onClick: () => navigate(`/app/messages/${i}`),
  }));

  return (
    <div className="msgs-layout">
      <LeftPanel convos={convos} activeConvo={activeIdx} />
      <CenterPanel convo={activeConvo} />
      <RightPanel convo={activeConvo} />
    </div>
  )
}

function LeftPanel({ convos, activeConvo }: { convos: any[]; activeConvo: number }) {
  return (
    <div className="msgs-left-panel">
      <div className="msgs-left-header">
        <h2 className="msgs-inbox-heading">Inbox</h2>
        <div className="msgs-filter-row">
          {filterPills.map((p, i) => (
            <span key={i} className={i === 0 ? 'msgs-filter-pill msgs-filter-pill-active' : 'msgs-filter-pill msgs-filter-pill-inactive'}>{p}</span>
          ))}
        </div>
      </div>
      <div className="msgs-convo-list">
        {convos.map((c: any, i: number) => {
          const active = i === activeConvo
          return (
            <div key={i} onClick={c.onClick}
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

function CenterPanel({ convo }: { convo: any }) {
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
        {convo.hasTrip && convo.linkName ? (
          <button onClick={() => navigate('/app/trips/0')} className="msgs-open-trip-btn">
            Open trip &nbsp;\u2197
          </button>
        ) : null}
      </div>

      <div className="msgs-msgs-area">
        {convo.msgs.map((m: any, i: number) => (
          <div key={i} className="msgs-msg-row" style={{
            justifyContent: m.align || (m.me ? 'flex-end' : 'flex-start'),
          }}>
            <div className="msgs-bubble" style={{
              background: m.bubbleBg || (m.me ? '#2B63F6' : '#fff'),
              color: m.bubbleFg || (m.me ? '#fff' : '#15161B'),
              border: m.bubbleBorder || (m.me ? 'none' : '1px solid #ECEDF2'),
              textAlign: m.textAlign || (m.me ? 'right' : 'left') as any,
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
        <div className="msgs-draft-label">
          Meridian draft reply:
        </div>
        <div className="msgs-draft-text">
          Thanks for your message! Let me look into that for you.
        </div>
        <button className="msgs-use-btn">Use</button>
      </div>

      <div className="msgs-input-bar">
        <input placeholder="Type a reply\u2026" className="msgs-input" />
        <button className="msgs-send-btn">
          {'\u27A4'}
        </button>
      </div>
    </div>
  )
}

function RightPanel({ convo }: { convo: any }) {
  const ctx = useApp();
  if (!convo) {
    return <div className="msgs-right-empty" />
  }

  if (convo.hasTrip) {
    return (
      <div className="msgs-right-panel">
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
        <div className="msgs-no-trip-icon">{'\uD83D\uDC8C'}</div>
        <div className="msgs-no-trip-title">
          No trip yet
        </div>
        <div className="msgs-no-trip-desc">
          Turn this chat into a structured trip workspace.
        </div>
      </div>

      <div className="msgs-create-card">
        <div className="msgs-create-icon">{'\uD83E\uDDF1'}</div>
        <div className="msgs-create-card-title">
          Turn this chat into a trip
        </div>
        <div className="msgs-create-card-desc">
          Create a trip from this conversation and Meridian will extract the brief and draft itinerary options.
        </div>
        <button onClick={() => ctx.createTripFromConvo(convo.name)} className="msgs-create-btn">
          Create trip from this chat
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
