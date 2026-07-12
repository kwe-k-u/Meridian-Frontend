import { useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import logoWordmark from '../assets/logo/logo_wordmark.svg'
import '../styles/Landing.css'

// ── Landing ──────────────────────────────────────────────────
// Purpose: Public marketing page shown at "/" for signed-out visitors.
// Static content only — no API calls. Links out to /login and /signup.
// The "screenshots" below are HTML/CSS recreations of the real app screens (Dashboard,
// Messages, Financials), not actual captured images — kept in sync by hand as those pages change.

function BrowserFrame({ url, children }: { url: string; children: ReactNode }) {
  return (
    <div className="browser-frame">
      <div className="browser-frame-bar">
        <span className="browser-frame-dot" style={{ background: '#EC6A5E' }} />
        <span className="browser-frame-dot" style={{ background: '#F4BF4F' }} />
        <span className="browser-frame-dot" style={{ background: '#61C554' }} />
        <span className="browser-frame-url">{url}</span>
      </div>
      <div className="browser-frame-body">{children}</div>
    </div>
  )
}

function DashboardShot() {
  const trips = [
    { name: 'Asante–Mensah Honeymoon', where: 'Santorini · Amalfi', status: 'Awaiting review', bg: '#FFF3E0', fg: '#B7791F', cover: 'linear-gradient(135deg,#1B5BBE,#5AA0FF)', value: 'GHS 84,500' },
    { name: 'Adjei Family Dubai', where: 'Dubai', status: 'AI drafting', bg: '#EAF0FF', fg: '#2B63F6', cover: 'linear-gradient(135deg,#E08A2B,#F5C06B)', value: 'GHS 41,200' },
    { name: 'Owusu Corporate Retreat', where: 'Cape Town', status: 'Shared', bg: '#F0EBFF', fg: '#6B46C1', cover: 'linear-gradient(135deg,#0E7C8F,#36C5C0)', value: 'GHS 128,000' },
  ]
  return (
    <BrowserFrame url="app.meridian.com/dashboard">
      <div className="shot-header">
        <div>
          <p className="shot-title">Good morning, Kweku</p>
          <p className="shot-sub">Here's what's moving across your agency today</p>
        </div>
        <span className="shot-btn">+ New trip</span>
      </div>
      <div className="shot-stats">
        <div className="shot-stat"><span>Revenue · June</span><strong>GHS 64,300</strong><em>↑ 18% vs May</em></div>
        <div className="shot-stat"><span>Trips in motion</span><strong>12</strong><em>3 need attention</em></div>
        <div className="shot-stat"><span>Unread messages</span><strong>7</strong><em>Across 3 channels</em></div>
      </div>
      <p className="shot-list-label">Trips in motion</p>
      <div className="shot-list">
        {trips.map((t) => (
          <div key={t.name} className="shot-trip-row">
            <div className="shot-trip-cover" style={{ background: t.cover }} />
            <div className="shot-trip-info">
              <strong>{t.name}</strong>
              <span>{t.where}</span>
            </div>
            <span className="shot-pill" style={{ background: t.bg, color: t.fg }}>{t.status}</span>
            <span className="shot-value">{t.value}</span>
          </div>
        ))}
      </div>
    </BrowserFrame>
  )
}

function InboxShot() {
  const convos = [
    { name: 'Efua Danso', ch: 'WhatsApp', chColor: '#0E9F6E', chBg: '#E3F7EF', last: 'Do you plan honeymoons to the Maldives?', time: '4m', bg: '#2B63F6' },
    { name: 'The Adjei Family', ch: 'Gmail', chColor: '#D64545', chBg: '#FFE9E6', last: 'Re: Dubai July — do we need visas?', time: '3h', bg: '#2B63F6' },
    { name: 'Yaa Boateng', ch: 'Instagram', chColor: '#B7385C', chBg: '#FBE6EF', last: 'Loved option B but can we change…', time: '1d', bg: '#D64545' },
  ]
  return (
    <BrowserFrame url="app.meridian.com/messages">
      <div className="shot-header">
        <div>
          <p className="shot-title">Inbox</p>
          <p className="shot-sub">Every channel, one thread per traveler</p>
        </div>
      </div>
      <div className="shot-list">
        {convos.map((c) => (
          <div key={c.name} className="shot-convo-row">
            <span className="shot-avatar">{c.name.split(' ').map((w) => w[0]).slice(0, 2).join('')}</span>
            <div className="shot-trip-info">
              <strong>{c.name}</strong>
              <span>{c.last}</span>
            </div>
            <span className="shot-pill" style={{ background: c.chBg, color: c.chColor }}>{c.ch}</span>
            <span className="shot-time">{c.time}</span>
          </div>
        ))}
      </div>
    </BrowserFrame>
  )
}

function ItineraryShot() {
  const options = [
    { letter: 'A', name: 'Santorini + Amalfi', sub: 'Greece & Italy · 10 nts', rec: true },
    { letter: 'B', name: 'Maldives', sub: 'Overwater · 9 nts', rec: false },
    { letter: 'C', name: 'Zanzibar & Safari', sub: 'Tanzania · 11 nts', rec: false },
  ]
  return (
    <BrowserFrame url="app.meridian.com/trips/asante-mensah">
      <div className="shot-header">
        <div>
          <p className="shot-title">Asante–Mensah Honeymoon</p>
          <p className="shot-sub">3 itinerary options for this request</p>
        </div>
        <span className="shot-pill" style={{ background: '#FFF3E0', color: '#B7791F' }}>Awaiting review</span>
      </div>
      <div className="shot-options">
        {options.map((o) => (
          <div key={o.letter} className={`shot-option${o.rec ? ' shot-option--rec' : ''}`}>
            {o.rec && <span className="shot-option-badge">Recommended</span>}
            <span className="shot-option-letter">{o.letter}</span>
            <strong>{o.name}</strong>
            <span>{o.sub}</span>
          </div>
        ))}
      </div>
      <p className="shot-list-label">Cost breakdown</p>
      <div className="shot-costs">
        <div><span>Flights</span><span>GHS 28,400</span></div>
        <div><span>Stays</span><span>GHS 41,200</span></div>
        <div><span>Activities</span><span>GHS 9,800</span></div>
      </div>
    </BrowserFrame>
  )
}

function FinancialsShot() {
  const bars = [38, 42, 51, 47, 58, 64]
  return (
    <BrowserFrame url="app.meridian.com/financials">
      <div className="shot-header">
        <div>
          <p className="shot-title">Financials</p>
          <p className="shot-sub">Revenue, payouts and outstanding balances</p>
        </div>
      </div>
      <div className="shot-stats">
        <div className="shot-stat"><span>Revenue</span><strong>GHS 64,300</strong><em>↑ 18%</em></div>
        <div className="shot-stat"><span>Outstanding</span><strong>GHS 22,800</strong><em>3 invoices</em></div>
        <div className="shot-stat"><span>Paid out</span><strong>GHS 41,500</strong><em>Next 24 Jun</em></div>
      </div>
      <div className="shot-chart">
        {bars.map((h, i) => (
          <div key={i} className="shot-bar" style={{ height: `${h}%`, background: i === bars.length - 1 ? '#2B63F6' : '#DCE6FF' }} />
        ))}
      </div>
      <div className="shot-invoice-row">
        <span>INV-0042 · Owusu Group</span>
        <span className="shot-pill" style={{ background: '#E3F7EF', color: '#0E9F6E' }}>Paid</span>
        <span className="shot-value">GHS 4,200</span>
      </div>
    </BrowserFrame>
  )
}

const featureRows = [
  {
    label: 'Unified inbox',
    title: 'Every enquiry lands in one place',
    body: 'WhatsApp Business, Gmail and Instagram messages are pulled into a single inbox, each conversation already linked to the right trip and traveler — so nothing gets missed between channels.',
    bullets: ['One thread per traveler, across every channel', 'New enquiries automatically become draft trips', 'Full message history alongside the itinerary'],
    shot: <InboxShot />,
    reverse: false,
  },
  {
    label: 'Itinerary drafting',
    title: 'Itinerary options, drafted for you',
    body: 'Meridian reads the enquiry — chat, email or a call summary — and puts together flight, stay and activity options within your budget and preferences, ready for you to review and send.',
    bullets: ['Multiple options generated per trip', 'Full day-by-day itinerary with running costs', 'You stay in control — review before it goes out'],
    shot: <ItineraryShot />,
    reverse: true,
  },
  {
    label: 'Payments & reporting',
    title: 'Get paid without the back-and-forth',
    body: 'Send a secure payment link, collect deposits or full balances through Paystack or Moolre, and watch revenue, outstanding balances and payouts roll up automatically.',
    bullets: ['Deposit and balance payment links', 'Automatic invoice reconciliation', 'Monthly revenue and payout reporting'],
    shot: <FinancialsShot />,
    reverse: false,
  },
]

const steps = [
  { n: '01', title: 'Connect your channels', body: 'Link WhatsApp Business, Gmail and Instagram in a few clicks — no technical setup required.' },
  { n: '02', title: 'Let Meridian draft', body: 'Every new enquiry becomes a trip with itinerary options drafted and ready to review.' },
  { n: '03', title: 'Share, book, get paid', body: 'Send the plan to your traveler, collect payment, and track the whole trip in one place.' },
]

const plans = [
  { name: 'Starter', tag: 'For solo agents & small teams', price: 'GHS 450', per: '/month', popular: false,
    features: ['1 workspace', 'Up to 50 trips / month', '2 connected channels', 'Itinerary drafting', 'Email support'] },
  { name: 'Growth', tag: 'For growing agencies', price: 'GHS 1,200', per: '/month', popular: true,
    features: ['Everything in Starter', 'Unlimited trips', 'All channels — WhatsApp, Gmail, IG', 'Call summaries & action points', 'Paystack payments', '5 team seats', 'Priority support'] },
  { name: 'Enterprise', tag: 'For large travel operators', price: 'Custom', per: '', popular: false,
    features: ['Everything in Growth', 'Unlimited team seats', 'SSO & advanced roles', 'Dedicated onboarding', 'SLA support', 'Custom integrations'] },
]

const faqs = [
  { q: 'Which channels can Meridian connect to?', a: 'Meridian currently connects to WhatsApp Business, Gmail and Instagram Direct Messages. Every message from any of these channels lands in one inbox, linked to the right trip.' },
  { q: 'How does the itinerary drafting work?', a: 'When a new enquiry comes in — by chat, email or a summarised call — Meridian drafts flight, stay and activity options based on the budget, dates and preferences mentioned. You review, adjust and send.' },
  { q: 'Can I collect payments through Meridian?', a: 'Yes. You can send deposit or balance payment links to travelers, which are processed through Paystack or Moolre. Payments are reconciled against the trip invoice automatically.' },
  { q: 'Is there a free trial?', a: 'Yes — every plan starts with a free 14-day trial, no credit card required. You can invite your team and connect your channels right away.' },
  { q: 'Can my whole team use one account?', a: 'Yes. The Growth and Enterprise plans include multiple team seats with role-based permissions (admin, agent, finance, read-only), so everyone sees only what they need to.' },
  { q: 'What happens after my trial ends?', a: 'Choose a plan to keep going — none of your trips, travelers or conversations are affected. If you don\'t choose a plan, your workspace is paused, not deleted.' },
]

function FaqItem({ q, a, open, onToggle }: { q: string; a: string; open: boolean; onToggle: () => void }) {
  return (
    <div className={`faq-item${open ? ' faq-item--open' : ''}`}>
      <button type="button" className="faq-question" onClick={onToggle} aria-expanded={open}>
        {q}
        <span className="faq-toggle">{open ? '−' : '+'}</span>
      </button>
      {open && <p className="faq-answer">{a}</p>}
    </div>
  )
}

function Landing() {
  const [openFaq, setOpenFaq] = useState<number | null>(0)

  return (
    <div className="landing-page">
      <header className="landing-nav">
        <img src={logoWordmark} alt="Meridian" className="landing-nav-logo" />
        <nav className="landing-nav-links">
          <a href="#features">Features</a>
          <a href="#how-it-works">How it works</a>
          <a href="#pricing">Pricing</a>
          <a href="#faq">FAQ</a>
        </nav>
        <div className="landing-nav-actions">
          <Link to="/login" className="landing-link-btn">Sign in</Link>
          <Link to="/signup" className="btn-primary">Start free trial</Link>
        </div>
      </header>

      <main>
        <section className="landing-hero">
          <div className="landing-hero-copy">
            <h1>One workspace for every trip, message and payment</h1>
            <p>
              Meridian brings your WhatsApp, Gmail and Instagram enquiries, itineraries,
              travelers and payments into a single, organized workspace built for travel agencies.
            </p>
            <div className="landing-hero-actions">
              <Link to="/signup" className="btn-primary landing-cta">Start free trial</Link>
              <Link to="/login" className="btn-secondary landing-cta">Sign in</Link>
            </div>
            <p className="landing-hero-note">No credit card required · 14-day free trial</p>
          </div>

          <div className="landing-hero-visual">
            <DashboardShot />
          </div>
        </section>

        <section className="landing-stats">
          <div><strong>3</strong><span>Channels in one inbox</span></div>
          <div><strong>Minutes</strong><span>To draft an itinerary</span></div>
          <div><strong>2</strong><span>Payment providers built in</span></div>
        </section>

        <section id="features" className="landing-feature-rows">
          {featureRows.map((f) => (
            <div key={f.title} className={`landing-feature-row${f.reverse ? ' landing-feature-row--reverse' : ''}`}>
              <div className="landing-feature-row-copy">
                <span className="landing-feature-label">{f.label}</span>
                <h2>{f.title}</h2>
                <p>{f.body}</p>
                <ul className="landing-feature-bullets">
                  {f.bullets.map((b) => (
                    <li key={b}><span className="landing-check">✓</span>{b}</li>
                  ))}
                </ul>
              </div>
              <div className="landing-feature-row-shot">{f.shot}</div>
            </div>
          ))}
        </section>

        <section id="how-it-works" className="landing-section landing-section-alt">
          <h2>How it works</h2>
          <p className="landing-section-sub">From first message to booked trip in three steps.</p>
          <div className="landing-steps">
            {steps.map((s) => (
              <div key={s.n} className="landing-step">
                <div className="landing-step-num">{s.n}</div>
                <h3>{s.title}</h3>
                <p>{s.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="pricing" className="landing-section">
          <h2>Simple pricing that scales with you</h2>
          <p className="landing-section-sub">Start free for 14 days. No credit card required.</p>
          <div className="landing-pricing-grid">
            {plans.map((p) => (
              <div key={p.name} className={`landing-plan-card${p.popular ? ' landing-plan-card--popular' : ''}`}>
                {p.popular && <div className="landing-plan-badge">Most popular</div>}
                <p className="landing-plan-name">{p.name}</p>
                <p className="landing-plan-tag">{p.tag}</p>
                <p className="landing-plan-price">{p.price}<span>{p.per}</span></p>
                <Link to="/signup" className={p.popular ? 'btn-primary' : 'btn-secondary'}>
                  {p.price === 'Custom' ? 'Contact sales' : `Choose ${p.name}`}
                </Link>
                <ul className="landing-plan-features">
                  {p.features.map((f) => (
                    <li key={f}><span className="landing-check">✓</span>{f}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <section id="faq" className="landing-section landing-section-alt">
          <h2>Frequently asked questions</h2>
          <p className="landing-section-sub">Can't find what you're looking for? Reach out to our team.</p>
          <div className="faq-list">
            {faqs.map((f, i) => (
              <FaqItem
                key={f.q}
                q={f.q}
                a={f.a}
                open={openFaq === i}
                onToggle={() => setOpenFaq(openFaq === i ? null : i)}
              />
            ))}
          </div>
        </section>

        <section className="landing-cta-banner">
          <h2>Ready to bring your agency into one workspace?</h2>
          <p>Start your free 14-day trial — no credit card required.</p>
          <Link to="/signup" className="btn-primary landing-cta">Start free trial</Link>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="landing-footer-top">
          <img src={logoWordmark} alt="Meridian" className="landing-footer-logo" />
          <div className="landing-footer-cols">
            <div className="landing-footer-col">
              <span className="landing-footer-col-title">Product</span>
              <a href="#features">Features</a>
              <a href="#how-it-works">How it works</a>
              <a href="#pricing">Pricing</a>
            </div>
            <div className="landing-footer-col">
              <span className="landing-footer-col-title">Company</span>
              <a href="#faq">FAQ</a>
              <Link to="/login">Sign in</Link>
              <Link to="/signup">Sign up</Link>
            </div>
          </div>
        </div>
        <div className="landing-footer-bottom">
          <span>© {new Date().getFullYear()} Meridian. All rights reserved.</span>
        </div>
      </footer>
    </div>
  )
}

export default Landing
