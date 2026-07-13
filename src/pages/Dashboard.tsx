import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../contexts/AppContext';
import { useCurrency } from '../contexts/CurrencyContext';
import { ApiService } from '../services/api-service';
import type { DashboardResponse, GuideCard } from '../types/app';
import { apiStatusMeta } from '../constants/app';
import DemoBanner from '../components/DemoBanner';
import '../styles/Dashboard.css';

// ── Dashboard ─────────────────────────────────────────────────
// Purpose: Main landing page after login. Shows onboarding (new users) or
//          stats/trips/agent feed (established users).
// State: dashboardData, loading, onboarded toggle.
// API: ApiService.getDashboard.
//
// The "New user view" / "Established view" toggle at the top is a manual demo switch
// (ctx.onboarded from AppContext) — it's not derived from whether the user has actually
// created any trips, so a real account with real trips could still flip back to the
// onboarding checklist view.

const fmtDate = (d: string | null) => {
  if (!d) return 'TBD';
  const dt = new Date(d + 'T00:00:00');
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const getInitials = (name: string) =>
  name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();

const avatarColors = ['#2B63F6', '#0E9F6E', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

const guideCover: Record<string, string> = {
  connect: 'linear-gradient(135deg,#1B5BBE,#5AA0FF)',
  trip: 'linear-gradient(135deg,#0E7C8F,#36C5C0)',
  draft: 'linear-gradient(135deg,#7C3AED,#B58CF5)',
  share: 'linear-gradient(135deg,#E08A2B,#F5C06B)',
  calls: 'linear-gradient(135deg,#C2410C,#F59E5B)',
  inbox: 'linear-gradient(135deg,#15803D,#5DBE7E)',
};

const guideCards: GuideCard[] = [
  { title:'Connect your channels', excerpt:'Bring WhatsApp, Gmail and Instagram into one inbox.', cover:guideCover.connect, cat:'Getting started', catBg:'#EAF0FF', catFg:'#2B63F6', read:'4 min', icon:'connect', open:() => {} },
  { title:'Create your first trip', excerpt:'Turn a traveller\'s request into a structured trip workspace.', cover:guideCover.trip, cat:'Core workflow', catBg:'#E3F7EF', catFg:'#0E9F6E', read:'5 min', icon:'trip', open:() => {} },
  { title:'How Meridian drafts itineraries', excerpt:'Understand how Meridian turns a brief into itinerary options.', cover:guideCover.draft, cat:'AI drafting', catBg:'#F0EBFF', catFg:'#7C5CFC', read:'4 min', icon:'draft', open:() => {} },
  { title:'Share trips & get paid', excerpt:'Send a traveller view, collect deposits, reconcile payments.', cover:guideCover.share, cat:'Money', catBg:'#FFF3E0', catFg:'#B7791F', read:'5 min', icon:'share', open:() => {} },
];

interface OnboardingTask {
  slot: string;
  icon: string;
  title: string;
  desc: string;
  done: boolean;
  cta?: string;
  action?: () => void;
  ph: string;
}

function Dashboard() {
  const navigate = useNavigate();
  const ctx = useApp();
  const { format: fmtCurrency } = useCurrency();
  const {
    onboarded, obNewBg, obNewFg, obEstBg, obEstFg,
    setNewUser, setEstablished, openGenItin, openCreate,
  } = ctx;

  const [dashboardData, setDashboardData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    ApiService.getDashboard()
      .then(data => setDashboardData(data))
      .catch(err => console.error('Failed to load dashboard:', err))
      .finally(() => setLoading(false));
  }, []);

  const agentFeed = ctx.getAgentFeed();

  const hasTrips = (dashboardData?.latest_trips?.length ?? 0) > 0;

  const onboardTasks: OnboardingTask[] = [
    {
      slot: 'ob-account',
      icon: '💬',
      title: 'Connect your account',
      desc: 'Your account is ready. Start managing your travel agency.',
      done: true,
      ph: 'Drop a workspace photo',
    },
    {
      slot: 'ob-trip',
      icon: '🧳',
      title: 'Create first trip',
      desc: 'Set up your first travel experience to share with travelers.',
      done: hasTrips,
      cta: 'Create trip',
      action: openCreate,
      ph: 'Drop a travel photo',
    },
    {
      slot: 'ob-itin',
      icon: '✦',
      title: 'Generate first itinerary',
      desc: 'Let Meridian automate your first itinerary creation.',
      done: hasTrips,
      cta: 'Generate itinerary',
      action: openGenItin,
      ph: 'Drop a planning photo',
    },
  ];

  const stats = dashboardData
    ? [
        { label: 'Revenue', value: fmtCurrency(dashboardData.revenue.amount), delta: `+${dashboardData.revenue.previous_cmp}%`, deltaColor: '#1DB954' },
        { label: 'Outstanding', value: fmtCurrency(dashboardData.outstanding.amount), delta: `${dashboardData.outstanding.count} items`, deltaColor: '#F59E0B' },
        { label: 'Paid out', value: fmtCurrency(dashboardData.paid_out.amount), delta: `Next payout ${fmtDate(dashboardData.paid_out.next_payout)}`, deltaColor: '#2B63F6' },
        { label: 'Refunds', value: fmtCurrency(dashboardData.refunds.amount), delta: `${dashboardData.refunds.count} this month`, deltaColor: '#EF4444' },
      ]
    : null;

  const tripsInMotion = dashboardData
    ? dashboardData.latest_trips.map((t, i) => {
        const sc = apiStatusMeta[t.status];
        return {
          id: t.trip_id,
          name: t.trip_name,
          initials: getInitials(t.trip_name),
          cover: avatarColors[i % avatarColors.length],
          status: sc.display,
          statusBg: sc.bg,
          statusFg: sc.fg,
          dates: `${fmtDate(t.start_date)} - ${fmtDate(t.end_date)}`,
          next: sc.display,
        };
      })
    : [];

  const doneCount = onboardTasks.filter(t => t.done).length;
  const totalCount = onboardTasks.length;
  const pct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  // Default straight to the Established view once the dashboard has loaded, if the onboarding
  // checklist is already fully done (e.g. an account that already has trips) — otherwise a
  // fully set-up account would still land on the onboarding screen on every visit. Gated on
  // `loading` so it only fires once per successful load, not on every render, which means the
  // manual "New user view" toggle above still works afterwards without being fought over.
  useEffect(() => {
    if (!loading && doneCount === totalCount) {
      setEstablished();
    }
  }, [loading, doneCount, totalCount, setEstablished]);

  const userName = dashboardData?.user?.display_name?.split(' ')[0] ?? 'Travel Agent';

  // ── Render ──

  return (
    <div className="dashboard-page">
      <div className="dashboard-view-toggle">
        <span className="dashboard-view-label">View:</span>
        <div className="dashboard-view-group">
          <button
            onClick={setNewUser}
            className="dashboard-view-btn"
            style={{ background: obNewBg, color: obNewFg }}
          >
            New user view
          </button>
          <button
            onClick={setEstablished}
            className="dashboard-view-btn"
            style={{ background: obEstBg, color: obEstFg }}
          >
            Established view
          </button>
        </div>
      </div>

      {loading && !dashboardData && (
        <div className="dashboard-loading">Loading your dashboard…</div>
      )}

      {!onboarded ? (
        <>
          <h1 className="dashboard-greeting">
            Welcome to Meridian, {userName} 👋
          </h1>

          <div className="dashboard-onboard-grid">
            {onboardTasks.map((t) => (
              <div key={t.slot} className="dashboard-onboard-card">
                <div className="dashboard-onboard-header">
                  <span className="dashboard-onboard-ph">{t.ph}</span>
                  <div className="dashboard-onboard-icon-wrapper">
                    {t.icon}
                  </div>
                </div>
                <div className="dashboard-onboard-body">
                  <h3 className="dashboard-onboard-title">{t.title}</h3>
                  <p className="dashboard-onboard-desc">{t.desc}</p>
                  {t.done ? (
                    <span className="dashboard-completed-badge">
                      ✓ Completed
                    </span>
                  ) : (
                    <button
                      onClick={t.action}
                      className="dashboard-onboard-cta"
                    >
                      {t.cta || 'Continue'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="dashboard-progress-section">
            <div className="dashboard-progress-header">
              <span className="dashboard-progress-label">You're almost set up — {doneCount} of {totalCount} done</span>
              <span className="dashboard-progress-pct">{pct}%</span>
            </div>
            <div className="dashboard-progress-track">
              <div className="dashboard-progress-fill" style={{ width: `${pct}%` }} />
            </div>
          </div>

          <div>
            <DemoBanner label="Demo feature — guide cards shown are sample content" />
            <h2 className="dashboard-works-title">How Meridian works</h2>
            <p className="dashboard-works-sub">
              Get started with these guides to running your agency on Meridian.
            </p>
            <div className="dashboard-works-scroll">
              {guideCards.map((c, i) => (
                <div
                  key={i}
                  onClick={() => navigate(`/app/help/${c.icon}`)}
                  className="dashboard-works-card"
                  style={{ background: c.cover }}
                >
                  <div className="dashboard-works-play">▶</div>
                  <div style={{ padding: 16 }}>
                    <span className="dashboard-works-label">{c.cat}</span>
                    <h3 className="dashboard-works-card-title">{c.title}</h3>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="dashboard-hero-section">
            <div className="dashboard-hero-content">
              <h1 className="dashboard-hero-title">
                Welcome back, {userName} 👋
              </h1>
              <p className="dashboard-hero-desc">
                Meridian handled {dashboardData?.ai_handled_tasks ?? 0} tasks this week across your active trips.
              </p>
              <button
                onClick={() => {}}
                className="dashboard-hero-btn"
              >
                Review {dashboardData?.pending_review_tasks ?? 0} items →
              </button>
            </div>
          </div>

          {stats && (
            <div className="dashboard-stats-grid">
              {stats.map((s, i) => (
                <div key={i} className="dashboard-stat-card">
                  <div className="dashboard-stat-label">{s.label}</div>
                  <div className="dashboard-stat-value">{s.value}</div>
                  <div className="dashboard-stat-delta" style={{ color: s.deltaColor || '#8A90A2' }}>{s.delta}</div>
                </div>
              ))}
            </div>
          )}

          <div className="dashboard-panels">
            <div className="dashboard-panel">
              <div className="dashboard-panel-header">
                <h3 className="dashboard-panel-title">Trips in motion</h3>
              </div>
              {tripsInMotion.length === 0 ? (
                <div className="dashboard-empty-panel">
                  <p>No trips yet. Create your first trip to get started.</p>
                  <button onClick={() => navigate('/app/trips')} className="dashboard-hero-btn">
                    Create trip →
                  </button>
                </div>
              ) : (
                tripsInMotion.slice(0, 4).map((t) => (
                  <div
                    key={t.id}
                    onClick={() => navigate(`/app/trips/${t.id}`)}
                    className="dashboard-trip-row"
                  >
                    <div className="dashboard-trip-avatar" style={{ background: t.cover }}>
                      {t.initials}
                    </div>
                    <div className="dashboard-trip-info">
                      <div className="dashboard-trip-name">{t.name}</div>
                      <div className="dashboard-trip-next">{t.next}</div>
                    </div>
                    <div className="dashboard-trip-meta">
                      <span className="dashboard-trip-status" style={{ background: t.statusBg, color: t.statusFg }}>
                        {t.status}
                      </span>
                      <span className="dashboard-trip-dates">{t.dates}</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="dashboard-panel">
              <div className="dashboard-panel-header" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="dashboard-activity-dot">
                  <span className="dashboard-activity-dot-pulse" />
                </span>
                <h3 className="dashboard-panel-title">Meridian activity</h3>
              </div>
              {agentFeed.map((f, i) => (
                <div key={i} className="dashboard-feed-item">
                  <div className="dashboard-feed-icon" style={{ background: f.iconBg }}>
                    {f.iconEl}
                  </div>
                  <div className="dashboard-feed-content">
                    <div className="dashboard-feed-title">{f.title}</div>
                    <div className="dashboard-feed-detail">{f.detail}</div>
                    <div className="dashboard-feed-actions">
                      <button onClick={f.action} className="dashboard-feed-btn">
                        {f.actionLabel}
                      </button>
                      <span className="dashboard-feed-time">{f.time}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default Dashboard;
