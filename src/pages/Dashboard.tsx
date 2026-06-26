import { useNavigate } from 'react-router-dom';
import { useApp } from '../contexts/AppContext';
import '../styles/Dashboard.css';

function Dashboard() {
  const navigate = useNavigate();
  const ctx = useApp();
  const {
    onboarded, obNewBg, obNewFg, obEstBg, obEstFg,
    setNewUser, setEstablished,
  } = ctx;

  const onboardTasks = ctx.getOnboardTasks();
  const worksCards = ctx.getGuideList().worksCards;
  const stats = ctx.getDashboardStats();
  const tripsInMotion = ctx.getTripsData().filter(t => ['AI drafting', 'Awaiting review', 'Shared', 'Changes requested', 'Confirmed'].includes(t.status));
  const agentFeed = ctx.getAgentFeed();

  const doneCount = onboardTasks.filter(t => t.done).length;
  const totalCount = onboardTasks.length;
  const pct = Math.round((doneCount / totalCount) * 100);

  return (
    <div className="dashboard-page">
      {/* Top toggle */}
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

      {!onboarded ? (
        <>
          <h1 className="dashboard-greeting">
            Welcome to Meridian, Kweku 👋
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
            <h2 className="dashboard-works-title">How Meridian works</h2>
            <p className="dashboard-works-sub">
              Get started with these guides to running your agency on Meridian.
            </p>
            <div className="dashboard-works-scroll">
              {worksCards.map((c, i) => (
                <div
                  key={i}
                  onClick={() => navigate(`/app/help/${c.icon}`)}
                  className="dashboard-works-card"
                  style={{ background: c.cover }}
                >
                  <div className="dashboard-works-play">
                    ▶
                  </div>
                  <div style={{ padding: 16 }}>
                    <span className="dashboard-works-label">
                      {c.cat}
                    </span>
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
                Welcome back, Kweku 👋
              </h1>
              <p className="dashboard-hero-desc">
                Meridian handled 14 tasks this week across your active trips.
              </p>
              <button
                onClick={() => {}}
                className="dashboard-hero-btn"
              >
                Review 3 items →
              </button>
            </div>
          </div>

          <div className="dashboard-stats-grid">
            {stats.map((s, i) => (
              <div key={i} className="dashboard-stat-card">
                <div className="dashboard-stat-label">{s.label}</div>
                <div className="dashboard-stat-value">{s.value}</div>
                <div className="dashboard-stat-delta" style={{ color: s.deltaColor || '#8A90A2' }}>{s.delta}</div>
              </div>
            ))}
          </div>

          <div className="dashboard-panels">
            <div className="dashboard-panel">
              <div className="dashboard-panel-header">
                <h3 className="dashboard-panel-title">Trips in motion</h3>
              </div>
              {tripsInMotion.slice(0, 4).map((t, i) => (
                <div
                  key={i}
                  onClick={() => navigate(`/app/trips/${i}`)}
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
              ))}
            </div>

            <div className="dashboard-panel">
              <div className="dashboard-panel-header" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="dashboard-activity-dot">
                  <span className="dashboard-activity-dot-pulse" />
                </span>
                <h3 className="dashboard-panel-title">Meridian activity</h3>
              </div>
              {agentFeed.map((f, i) => (
                <div
                  key={i}
                  className="dashboard-feed-item"
                >
                  <div className="dashboard-feed-icon" style={{ background: f.iconBg }}>
                    {f.iconEl}
                  </div>
                  <div className="dashboard-feed-content">
                    <div className="dashboard-feed-title">{f.title}</div>
                    <div className="dashboard-feed-detail">{f.detail}</div>
                    <div className="dashboard-feed-actions">
                      <button
                        onClick={f.action}
                        className="dashboard-feed-btn"
                      >
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
