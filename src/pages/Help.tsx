import { useNavigate } from 'react-router-dom'
import { useApp } from '../contexts/AppContext'
import '../styles/Help.css'

// ── Help ───────────────────────────────────────────────────────
// Purpose: Help center landing page showing featured guide and grid
//          of all guide cards.
// State: None (data from AppContext).
// API: None (data from AppContext).

export default function Help() {
  const navigate = useNavigate()
  const ctx = useApp()
  const { featured, guideCards } = ctx.getGuideList()

  return (
    <div className="page-container">
      <div className="help-hero">
        <h1 className="help-hero-title">How can we help?</h1>
        <input className="help-search-input" placeholder="Search guides, topics or keywords…" />
      </div>
      <div className="help-featured-card">
        <div className="help-cover-side" style={{ background: featured.cover }}>
          <div className="help-play-btn">▶</div>
        </div>
        <div className="help-content-side">
          <span className="help-cat-badge" style={{ background: featured.catBg, color: featured.catFg }}>{featured.cat}</span>
          <h3 className="help-feat-title">{featured.title}</h3>
          <p className="help-feat-excerpt">{featured.excerpt}</p>
          <button className="help-read-link" onClick={() => navigate('/app/help/' + featured.cat)}>Read guide →</button>
        </div>
      </div>
      <h2 className="help-all-head">All guides</h2>
      <div className="grid-3">
        {guideCards.map((g, i) => (
          <div key={i} className="help-guide-card" onClick={() => navigate('/app/help/' + g.icon)}>
            <div className="help-g-cover" style={{ background: g.cover }}>
              <div className="help-g-play">▶</div>
              <span className="help-g-cat" style={{ background: g.catBg, color: g.catFg }}>{g.cat}</span>
            </div>
            <div className="help-g-body">
              <p className="help-g-title">{g.title}</p>
              <p className="help-g-excerpt">{g.excerpt}</p>
              <p className="help-g-read">{g.read}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
