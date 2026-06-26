import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useApp } from '../contexts/AppContext';
import type { TripOption } from '../types/app';
import { useEffect } from 'react';
import '../styles/TripDetail.css';

export default function TripDetail() {
  const { tripId } = useParams<{ tripId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const ctx = useApp();
  const tid = tripId ? parseInt(tripId, 10) : 0;
  const { activeOption, setActiveOption, builderTab, setBuilderTab, activeCall, setActiveCall } = ctx;

  const { td, tb } = ctx.getTripDetail(tid, activeOption);

  const rawDays = ctx.getDays(tid, activeOption);
  const days = rawDays.map((d, di) => ({
    ...d,
    di: d.di ?? di,
    blocks: d.blocks.map((b, bi) => ({
      ...b,
      remove: () => ctx.removeBlock(di, bi),
    })),
    addSuggestion: d.hasSuggestion ? () => ctx.addSuggestion(di) : undefined,
    addBlock: () => ctx.addBlock(di),
  }));

  const flights = ctx.getFlights();
  const stays = ctx.getStays();
  const activitiesData = ctx.getActivities().map(a => ({
    ...a,
    add: () => ctx.addActivity({ name: a.name, meta: a.meta, price: a.price }),
  }));
  const { calls: callLogsArr, callDetails } = ctx.getCallLogs();
  const call = callDetails[activeCall] ?? null;
  const agentFeed = ctx.getAgentFeed();

  useEffect(() => {
    const state = location.state as { triggerGenerate?: boolean } | null;
    if (state?.triggerGenerate) {
      ctx.generateOptions();
      window.history.replaceState({}, '');
    }
  }, []);

  const costs = td.costs || [];
  const tripAgent = ['Kweku Ansah', 'Adwoa Mensah', 'Yaw Boateng', 'Efua Osei'][tid % 4];

  const builderTabs = [
    { key: 'itinerary' as const, label: 'Itinerary' },
    { key: 'flights' as const, label: 'Flights' },
    { key: 'stays' as const, label: 'Stays' },
    { key: 'activities' as const, label: 'Activities' },
    { key: 'calls' as const, label: 'Calls' },
  ];

  const tabItin = builderTab === 'itinerary';
  const tabFlights = builderTab === 'flights';
  const tabStays = builderTab === 'stays';
  const tabActs = builderTab === 'activities';
  const tabCalls = builderTab === 'calls';

  const handleGenerateOptions = () => {
    ctx.openGenItin();
  };

  const handleMessageTraveler = () => {
    navigate('/app/messages');
  };

  const handleOpenTravelerView = () => {
    navigate('/travel/' + tid);
  };

  const options: TripOption[] = td.options.map(o => ({
    ...o,
    onClick: () => setActiveOption(o.letter),
  }));

  const optLabel = td.optionsLabel || (options.length > 1
    ? `${options.length} itinerary options for this request:`
    : 'Itinerary option:');

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
                <h1 className="td-hero-title">
                  {td.name}
                </h1>
                <span className="td-hero-status" style={{ background: td.statusBg, color: td.statusFg }}>
                  {td.status}
                </span>
              </div>
              <div className="td-hero-meta">
                <span>{td.traveler}</span>
                <span className="td-hero-dot" />
                <span>{td.where}</span>
                <span className="td-hero-dot" />
                <span>{td.dates}</span>
                <span className="td-hero-dot" />
                <span className="td-hero-value">{td.value}</span>
              </div>
            </div>
            <div className="td-hero-actions">
              {td.status === 'Draft' && (
                <>
                  <button onClick={handleGenerateOptions} className="td-action-btn" style={{ background: '#2B63F6', color: '#fff', borderColor: '#2B63F6' }}>
                    ✦ Generate options
                  </button>
                  <button onClick={handleMessageTraveler} className="td-action-btn" style={{ background: '#fff', color: '#5B6172', borderColor: '#DDE0E8' }}>
                    Message {td.traveler.split(' ')[0]}
                  </button>
                </>
              )}
              {td.status === 'Awaiting review' && (
                <>
                  <button onClick={handleOpenTravelerView} className="td-action-btn" style={{ background: '#fff', color: '#5B6172', borderColor: '#DDE0E8' }}>Preview</button>
                  <button onClick={handleMessageTraveler} className="td-action-btn" style={{ background: '#2B63F6', color: '#fff', borderColor: '#2B63F6' }}>
                    Share with {td.traveler.split(' ')[0]}
                  </button>
                </>
              )}
              {td.status === 'Shared' && (
                <>
                  <button onClick={() => {}} className="td-action-btn" style={{ background: '#fff', color: '#5B6172', borderColor: '#DDE0E8' }}>Resend link</button>
                  <button onClick={handleMessageTraveler} className="td-action-btn" style={{ background: '#2B63F6', color: '#fff', borderColor: '#2B63F6' }}>
                    Nudge {td.traveler.split(' ')[0]}
                  </button>
                </>
              )}
              {td.status === 'Changes requested' && (
                <>
                  <button onClick={() => {}} className="td-action-btn" style={{ background: '#2B63F6', color: '#fff', borderColor: '#2B63F6' }}>Make changes</button>
                  <button onClick={handleMessageTraveler} className="td-action-btn" style={{ background: '#fff', color: '#5B6172', borderColor: '#DDE0E8' }}>
                    Message {td.traveler.split(' ')[0]}
                  </button>
                </>
              )}
              {td.status === 'Confirmed' && (
                <>
                  <button onClick={() => {}} className="td-action-btn" style={{ background: '#13B981', color: '#fff', borderColor: '#13B981' }}>Send deposit link</button>
                  <button onClick={handleMessageTraveler} className="td-action-btn" style={{ background: '#fff', color: '#5B6172', borderColor: '#DDE0E8' }}>
                    Message {td.traveler.split(' ')[0]}
                  </button>
                </>
              )}
              {td.status === 'Booked' && (
                <>
                  <button onClick={() => {}} className="td-action-btn" style={{ background: '#fff', color: '#5B6172', borderColor: '#DDE0E8' }}>View trip pack</button>
                  <button onClick={handleMessageTraveler} className="td-action-btn" style={{ background: '#2B63F6', color: '#fff', borderColor: '#2B63F6' }}>
                    Message {td.traveler.split(' ')[0]}
                  </button>
                </>
              )}
              {!['Draft', 'Awaiting review', 'Shared', 'Changes requested', 'Confirmed', 'Booked'].includes(td.status) && (
                <>
                  <button onClick={handleOpenTravelerView} className="td-action-btn" style={{ background: '#fff', color: '#5B6172', borderColor: '#DDE0E8' }}>Preview</button>
                  <button onClick={() => {}} className="td-action-btn" style={{ background: '#2B63F6', color: '#fff', borderColor: '#2B63F6' }}>Share</button>
                </>
              )}
            </div>
          </div>
        </div>

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

        {tb.showOptions && options.length > 0 && (
          <div className="mb-24">
            <div className="td-options-label">
              {optLabel}
            </div>
            <div className="td-options-row">
              {options.map((opt) => {
                const isActive = activeOption === opt.letter;
                return (
                  <div
                    key={opt.letter}
                    onClick={opt.onClick}
                    className="td-pill-container"
                    style={{
                      borderColor: isActive ? '#2B63F6' : '#ECEDF2',
                      background: isActive ? '#F4F7FF' : '#fff',
                    }}
                  >
                    <div className="td-option-letter" style={{ background: opt.cover }}>
                      {opt.letter}
                    </div>
                    <div className="td-option-info">
                      <div className="td-option-name" style={{ color: isActive ? '#2B63F6' : '#15161B' }}>
                        {opt.name}
                      </div>
                      <div className="td-option-sub">
                        {opt.sub}
                      </div>
                    </div>
                    {opt.rec && (
                      <span className="td-ai-pick">
                        ✦ AI pick
                      </span>
                    )}
                  </div>
                );
              })}
              <div className="td-add-option">
                <span className="td-add-option-plus">+</span>
                <span className="td-add-option-label">Add option</span>
              </div>
            </div>
          </div>
        )}

        {tb.showDrafting && (
          <div className="td-drafting-state">
            <div className="td-drafting-icon">
              ✦
            </div>
            <div className="td-drafting-title">
              Meridian is building options…
            </div>
            <div className="td-drafting-bar">
              <div className="td-drafting-fill" />
            </div>
            <button
              onClick={ctx.revealOptions}
              className="td-drafting-skip"
            >
              Skip & preview
            </button>
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

        {tb.showBuilder && (
          <div className="td-builder-layout">
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
                    {days.map((day) => (
                      <div key={day.di} className="td-day-row">
                        <div className="td-day-col">
                          <span className="td-day-dow">
                            {day.dow}
                          </span>
                          <span className="td-day-num">
                            {day.day}
                          </span>
                          <span className="td-day-mon">
                            {day.mon}
                          </span>
                        </div>

                        <div className="td-timeline-col">
                          <div className="td-timeline-dot" />
                          <div className="td-timeline-line" />
                        </div>

                        <div className="td-day-body">
                          <div className="td-day-title">
                            {day.title}
                          </div>

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
                      </div>
                    ))}
                  </div>
                )}

                {tabFlights && (
                  <div>
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
                            <button
                              className="td-flight-cta"
                              style={{
                                border: f.cta === 'Selected' ? '1px solid #C4D2FF' : 'none',
                                background: f.cta === 'Selected' ? '#fff' : '#2B63F6',
                                color: f.cta === 'Selected' ? '#5B6172' : '#fff',
                              }}
                            >
                              {f.cta}
                            </button>
                          </div>
                          {f.recDisplay === 'inline-block' && (
                            <span className="td-flight-rec">
                              Recommended
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {tabStays && (
                  <div>
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
                              <button className="td-stay-select">
                                Select
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {tabActs && (
                  <div>
                    <p className="td-acts-desc">
                      Add activities to this itinerary. They'll appear on the last day.
                    </p>
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
                  </div>
                )}

                {tabCalls && (
                  <div className="td-calls-grid">
                    <div>
                      {callLogsArr.map((cl, i) => (
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
                      ))}
                    </div>

                    <div>
                      {call ? (
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
                )}
              </div>
            </div>

            <div className="td-sticky-sidebar">
              <div className="td-right-card">
                <div className="td-right-card-header">
                  <div className="td-right-card-title">
                    Cost summary
                  </div>
                </div>
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
                      {td.total}
                    </span>
                  </div>
                  <div className="td-cost-fee">
                    Service fee charged to traveller
                  </div>
                </div>
              </div>

              <div className="td-right-card">
                <div className="td-agent-header">
                  <span className="td-agent-dot" />
                  <span className="td-agent-title">
                    Agent activity
                  </span>
                </div>
                <div className="td-agent-name-row">
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
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
