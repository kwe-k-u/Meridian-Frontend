import { useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import logoWordmark from '../assets/logo/logo_wordmark.svg'
import '../styles/Landing.css'

// ── Landing ──────────────────────────────────────────────────
// Purpose: Public marketing page shown at "/" for signed-out visitors.
// Static content only — no API calls. Links out to /login and /signup.
// The "screenshots" below are HTML/CSS recreations of the real app screens (Itinerary,
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
    label: 'AI trip generation',
    title: 'A full itinerary, drafted and ready to edit',
    body: 'Meridian reads the enquiry — chat, email or a call summary — and drafts flight, stay and activity options within budget and preferences. Swap a hotel, change dates, adjust the budget: every detail is yours to edit before it ever reaches your traveler.',
    bullets: ['Multiple options generated per trip', 'Edit any flight, stay or activity in a couple of clicks', 'Full day-by-day itinerary with running costs'],
    shot: <ItineraryShot />,
    reverse: false,
  },
  {
    label: 'Connected channels',
    title: 'Enquiries from every channel become a trip',
    body: 'WhatsApp Business, Gmail and Instagram messages are pulled into one inbox and automatically turned into a draft trip — so generation starts the moment an enquiry lands.',
    bullets: ['One thread per traveler, across every channel', 'New enquiries automatically become draft trips', 'Full message history alongside the itinerary'],
    shot: <InboxShot />,
    reverse: true,
  },
  {
    label: 'Payments & reporting',
    title: 'Get paid without the back-and-forth',
    body: 'Once the itinerary is edited and sent, collect deposits or full balances through Paystack or Moolre, and watch revenue, outstanding balances and payouts roll up automatically.',
    bullets: ['Deposit and balance payment links', 'Automatic invoice reconciliation', 'Monthly revenue and payout reporting'],
    shot: <FinancialsShot />,
    reverse: false,
  },
]

const steps = [
  { n: '01', title: 'From enquiry to draft', body: 'Every new message, email or DM automatically becomes a trip with itinerary options drafted and ready to review.' },
  { n: '02', title: 'Edit until it\'s right', body: 'Swap a hotel, change dates, adjust the budget — refine any option before it goes anywhere near your traveler.' },
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

type FaqStatus = 'live' | 'progress'

const faqStatusMeta: Record<FaqStatus, { label: string; bg: string; fg: string }> = {
  live: { label: 'Live now', bg: '#E3F7EF', fg: '#0E9F6E' },
  progress: { label: 'In progress', bg: '#FFF3E0', fg: '#B7791F' },
}

interface FaqEntry {
  q: string
  a: string
  status?: FaqStatus | null
}

const faqs: FaqEntry[] = [
  { q: 'How does the itinerary drafting work?', status: 'live', a: 'Create a trip and tell Meridian the budget, travel style, dates and any notes — typed in or described in your own words — and it drafts flight, stay and activity options for you to review. This is live today. Automatically turning an inbound WhatsApp, Gmail or Instagram message straight into a draft trip is what we\'re building next (see the channels question below).' },
  { q: 'Can I edit the itinerary Meridian drafts?', status: 'live', a: 'Yes — every option is fully editable. Swap a hotel, change dates, adjust the budget, or add and remove activities, before you send anything to a traveler.' },
  { q: 'Which channels can Meridian connect to?', status: 'progress', a: 'We\'re building WhatsApp Business, Gmail and Instagram DM connections so every enquiry lands in one inbox automatically, already linked to a trip. That\'s not live yet — for now, you create trips directly inside Meridian and draft the itinerary from there. Once channel connections ship, an inbound message will land in the inbox and turn into a draft trip on its own.' },
  { q: 'Can I collect payments through Meridian?', status: 'live', a: 'Yes — send a deposit or balance payment link and your traveler pays through Moolre, reconciled against the trip automatically. Paystack support is on the roadmap and not connected yet; once it ships you\'ll be able to choose either provider.' },
  { q: 'Is there a free trial?', status: null, a: 'New workspaces get full access with no credit card and nothing locked while you get set up. We\'re still building the 14-day trial timer and the automatic switch to a paid plan afterwards — for now, nothing is time-limited or paused automatically.' },
  { q: 'Can my whole team use one account?', status: 'live', a: 'Yes. The Growth and Enterprise plans include multiple team seats with role-based permissions (admin, agent, finance, read-only), so everyone sees only what they need to.' },
  { q: 'What happens after my trial ends?', status: null, a: 'This is part of the trial timer we\'re building (see above) — once it ships, choosing a plan will carry everything over as-is, and a workspace that doesn\'t upgrade will be paused rather than deleted.' },
]

function FaqItem({ q, a, status, open, onToggle }: { q: string; a: string; status?: FaqStatus | null; open: boolean; onToggle: () => void }) {
  const meta = status ? faqStatusMeta[status] : null
  return (
    <div className={`faq-item${open ? ' faq-item--open' : ''}`}>
      <button type="button" className="faq-question" onClick={onToggle} aria-expanded={open}>
        <span className="faq-question-text">
          {q}
          {meta && <span className="faq-status-pill" style={{ background: meta.bg, color: meta.fg }}>{meta.label}</span>}
        </span>
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
            <h1>AI drafts the itinerary. You make it perfect.</h1>
            <p>
              Every enquiry becomes a full trip plan — flights, stays and activities drafted
              in minutes, with every detail editable before it goes to your traveler.
              Messaging, payments and trip tracking come along for free.
            </p>
            <div className="landing-hero-actions">
              <Link to="/signup" className="btn-primary landing-cta">Start free trial</Link>
              <Link to="/login" className="btn-secondary landing-cta">Sign in</Link>
            </div>
            <p className="landing-hero-note">No credit card required · 14-day free trial</p>
          </div>

          <div className="landing-hero-visual">
            <ItineraryShot />
          </div>
        </section>

        <section className="landing-stats">
          <div><strong>Minutes</strong><span>From enquiry to a full draft itinerary</span></div>
          <div><strong>100%</strong><span>Editable before anything is sent</span></div>
          <div><strong>3</strong><span>Channels feed straight into a draft</span></div>
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
                status={f.status}
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
