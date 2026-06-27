import { useParams, useNavigate } from 'react-router-dom';
import { useApp } from '../contexts/AppContext'
import '../styles/GuideArticle.css'

// ── GuideArticle ───────────────────────────────────────────────
// Purpose: Displays a single help guide/article with sections, tips,
//          and a video hero, fetched from AppContext by guideId.
// State: None (reads guideId from URL params).
// API: None (data from AppContext).

export default function GuideArticle() {
  const { guideId } = useParams<{ guideId: string }>();
  const navigate = useNavigate();
  const ctx = useApp()
  const guide = ctx.getGuideArticle(guideId || 'connect')

  return (
    <div className="guide-article-page">
      <button className="guide-back-link" onClick={() => navigate('/app/help')}>← All guides</button>
      <span className="guide-cat-badge" style={{ background: guide.catBg, color: guide.catFg }}>{guide.cat}</span>
      <h1 className="guide-title">{guide.title}</h1>
      <p className="guide-meta">Updated {guide.updated} · {guide.read}</p>
      <div className="guide-video-hero" style={{ background: guide.cover }}>
        <div className="guide-video-overlay">
          <div className="guide-vid-play-btn">▶</div>
          <p className="guide-vid-title">{guide.videoTitle}</p>
        </div>
      </div>
      {guide.sections.map((sec, i) => (
        <div key={i} className="guide-section">
          <h2 className="guide-sec-heading">{sec.h}</h2>
          {sec.paras.map((p, j) => (
            <p key={j} className="guide-para">{p}</p>
          ))}
          {sec.hasShot && (
            <div className="guide-shot-box">
              📸 {sec.shotLabel || 'Screenshot'}
            </div>
          )}
          {sec.hasTip && (
            <div className="guide-tip-box">
              <p className="guide-tip-head">💡 Tip</p>
              <p className="guide-tip-text">{sec.tip}</p>
            </div>
          )}
        </div>
      ))}
      <div className="guide-up-next" onClick={() => navigate('/app/help/' + guide.nextCat)}>
        <div className="guide-up-next-left">
          <span className="guide-up-next-label">Up next · {guide.nextCat}</span>
          <p className="guide-up-next-title">{guide.nextTitle}</p>
        </div>
        <span className="guide-up-next-arrow">→</span>
      </div>
    </div>
  )
}
