import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useApp } from '../contexts/AppContext'
import { useAuth } from '../contexts/AuthContext'
import { ApiService } from '../services/api-service'
import type { SettingsTab, CompanyResponse, CompanyUser, VirtualAccountResponse, WeWireBeneficiaryResponse, WeWireInboundResponse, WeWireDisbursementResponse, WeWireCryptoWalletResponse, FundHandling, WeWireKycStatus, GmailStatusResponse } from '../types/app'
import { WEWIRE_SUPPORTED_CURRENCIES, WEWIRE_MAX_ACCOUNTS, CRYPTO_WALLET_ASSETS, CRYPTO_WALLET_CHAINS } from '../types/app'
import DemoBanner from '../components/DemoBanner'
import '../styles/Settings.css'

// ── Settings ───────────────────────────────────────────────────
// Purpose: Tabbed settings page with Profile, Workspace, Team & Seats,
//          Roles, Channels, and Notification sub-panels.
// State: displayName, phone, saving (in EditProfile); company/team from API.
// API: updateProfile (AuthContext), getCompany/updateCompany, sendInvitation.
//
// Of the six tabs, Profile/Workspace/Team & Seats/Roles all fetch real data from the backend.
// Channels and Notifications are still fully static/local-only — Channels renders a
// hardcoded connect-button list (real connection would need actual OAuth/WhatsApp
// integrations), and Notifications keeps its toggle state in local useState with nowhere to
// persist it server-side yet.

const SETTINGS_TABS: { key: SettingsTab; label: string }[] = [
  { key: 'profile', label: 'Profile' },
  { key: 'workspace', label: 'Workspace' },
  { key: 'team', label: 'Team & Seats' },
  { key: 'roles', label: 'Roles' },
  { key: 'channels', label: 'Channels' },
  { key: 'notifications', label: 'Notifications' },
  { key: 'ai', label: 'AI & Models' },
  { key: 'payments', label: 'Payments' },
];

// ── TabBar ─────────────────────────────────────────────────────

function TabBar({ currentTab }: { currentTab: SettingsTab }) {
  const navigate = useNavigate();
  return (
    <div className="tab-bar">
      {SETTINGS_TABS.map((t) => (
        <button
          key={t.key}
          className={`tab-btn${currentTab === t.key ? ' active' : ''}`}
          onClick={() => navigate('/app/settings/' + t.key)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ── Workspace ──────────────────────────────────────────────────
// Fetches the user's default company and allows updating name/country/city/currency.

const SUPPORTED_CURRENCIES = ['GHS', 'USD', 'EUR', 'GBP'];

function Workspace() {
  const auth = useAuth();
  const { user } = auth;
  const { toastAction } = useApp();

  const defaultCompany: CompanyResponse | null = useMemo(() => {
    if (!user?.companies?.length) return null;
    const def = user.companies.find(c => c.pivot.is_default) ?? user.companies[0];
    return def as unknown as CompanyResponse;
  }, [user]);

  const [loading, setLoading] = useState(true);
  const [company, setCompany] = useState<CompanyResponse | null>(null);
  const [name, setName] = useState('');
  const [country, setCountry] = useState('');
  const [city, setCity] = useState('');
  const [currency, setCurrency] = useState('GHS');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!defaultCompany) { setLoading(false); return; }
    ApiService.getCompany(defaultCompany.company_id)
      .then(c => { setCompany(c); setName(c.company_name); setCountry(c.country ?? ''); setCity(c.city_of_operation ?? ''); setCurrency(c.preferred_currency ?? 'GHS'); })
      .catch(() => toastAction('Failed to load company'))
      .finally(() => setLoading(false));
  }, [defaultCompany]);

  const handleSave = async () => {
    if (!company) return;
    setSaving(true);
    try {
      const updated = await ApiService.updateCompany(company.company_id, {
        company_name: name,
        country: country || undefined,
        city_of_operation: city || undefined,
        preferred_currency: currency,
      });
      setCompany(updated);
      // The company data cached on the auth user (what CurrencyContext reads its
      // preferred_currency from) doesn't get refreshed by updateCompany above — patch it in
      // place so the new currency takes effect across the app immediately, not just here.
      auth.updateCompanyInProfile(company.company_id, { preferred_currency: updated.preferred_currency });
      toastAction('Company settings saved');
    } catch {
      toastAction('Failed to save company settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="settings-section"><p>Loading workspace settings...</p></div>;
  if (!company) return <div className="settings-section"><p>No company found. Contact support.</p></div>;

  return (
    <div className="settings-section">
      <div className="field-row">
        <label className="field-label">Company name</label>
        <input className="field-input" value={name} onChange={e => setName(e.target.value)} />
      </div>
      <div className="row-2">
        <div className="field-row">
          <label className="field-label">Country / Region</label>
          <input className="field-input" value={country} onChange={e => setCountry(e.target.value)} placeholder="e.g. Ghana" />
        </div>
        <div className="field-row">
          <label className="field-label">City of operation</label>
          <input className="field-input" value={city} onChange={e => setCity(e.target.value)} placeholder="e.g. Accra" />
        </div>
      </div>
      <div className="field-row">
        <label className="field-label">Preferred currency</label>
        <select className="field-input" value={currency} onChange={e => setCurrency(e.target.value)}>
          {SUPPORTED_CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <p style={{ fontSize: 12, color: '#8A90A2', marginTop: 4 }}>
          Amounts across the app (revenue, trip costs, payments) will display converted into this currency.
        </p>
      </div>
      <div className="btn-row btn-row-end">
        <button className="btn-cancel" onClick={() => { setName(company.company_name); setCountry(company.country ?? ''); setCity(company.city_of_operation ?? ''); setCurrency(company.preferred_currency ?? 'GHS'); }}>
          Cancel
        </button>
        <button className="btn-save" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  );
}

// ── Team & Seats ──────────────────────────────────────────────
// Fetches company users from the API and renders the team table with invite flow.

function TeamAndSeats() {
  const { user } = useAuth();
  const { toastAction } = useApp();
  const defaultCompanyId = useMemo(() => {
    const def = user?.companies?.find(c => c.pivot.is_default) ?? user?.companies?.[0];
    return def?.company_id ?? null;
  }, [user]);

  const [team, setTeam] = useState<CompanyUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [showInvite, setShowInvite] = useState(false);

  const fetchTeam = () => {
    if (!defaultCompanyId) { setLoading(false); return; }
    ApiService.getCompanyUsers(defaultCompanyId)
      .then(c => setTeam(c.users ?? []))
      .catch(() => toastAction('Failed to load team'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchTeam(); }, [defaultCompanyId]);

  const handleInvite = async () => {
    if (!inviteEmail.trim() || !defaultCompanyId || !user) return;
    setInviting(true);
    try {
      await ApiService.sendInvitation({
        company_id: defaultCompanyId,
        invited_by: user.user_id,
        email: inviteEmail.trim(),
        role: 'member',
      });
      toastAction(`Invitation sent to ${inviteEmail.trim()}`);
      setInviteEmail('');
      setShowInvite(false);
    } catch {
      toastAction('Failed to send invitation');
    } finally {
      setInviting(false);
    }
  };

  const seatsTotal = 5;
  const seatsUsed = team.length;

  if (loading) return <div className="settings-section-wide"><p>Loading team data...</p></div>;

  return (
    <div className="settings-section-wide">
      <div className="seat-section">
        <p className="seat-label">Seat usage</p>
        <div className="bar-outer"><div className="bar-inner" style={{ width: `${Math.min((seatsUsed / seatsTotal) * 100, 100)}%` }} /></div>
        <p className="seat-meta">{seatsUsed} of {seatsTotal} seats used</p>
      </div>

      <div className="table-card">
        <div className="th-row">
          <span className="th-text">Member</span>
          <span className="th-text">Role</span>
          <span className="th-text">Status</span>
          <span className="th-text"></span>
        </div>
        {team.map((m) => {
          const isYou = m.user_id === user?.user_id;
          const initials = (m.display_name || '?').split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
          const colors: Record<string, string> = { owner: '#16143A', admin: '#2B63F6', member: '#0E9F6E' };
          const bgColors: Record<string, string> = { owner: '#EEF0F4', admin: '#EAF0FF', member: '#E3F7EF' };
          const role = m.pivot.role || 'member';
          return (
            <div key={m.user_id} className="tr">
              <div className="avatar-row">
                <div className="avatar-circle-sm" style={{ background: bgColors[role] ?? '#EEF0F4' }}>{initials}</div>
                <div className="name-block">
                  <p className="name-text">{m.display_name} {isYou && <span className="you-label">(you)</span>}</p>
                  <p className="email-text">{m.email}</p>
                </div>
              </div>
              <span className="role-pill" style={{ background: bgColors[role] ?? '#EEF0F4', color: colors[role] ?? '#5B6172' }}>{role}</span>
              <span className="active-text">{m.pivot.is_enabled ? 'Active' : 'Inactive'}</span>
              <button className="menu-btn">⋯</button>
            </div>
          );
        })}
      </div>

      {showInvite ? (
        <div className="invite-row">
          <input
            className="field-input invite-input"
            value={inviteEmail}
            onChange={e => setInviteEmail(e.target.value)}
            placeholder="colleague@example.com"
          />
          <button className="btn-save" onClick={handleInvite} disabled={inviting || !inviteEmail.trim()}>
            {inviting ? 'Sending...' : 'Send'}
          </button>
          <button className="btn-cancel" onClick={() => { setShowInvite(false); setInviteEmail(''); }}>Cancel</button>
        </div>
      ) : (
        <button className="invite-btn" onClick={() => setShowInvite(true)}>Invite teammate</button>
      )}
    </div>
  );
}

// ── Roles ──────────────────────────────────────────────────────
// Computes role cards from the user list returned by the company API.

function Roles() {
  const { user } = useAuth();
  const defaultCompanyId = useMemo(() => {
    const def = user?.companies?.find(c => c.pivot.is_default) ?? user?.companies?.[0];
    return def?.company_id ?? null;
  }, [user]);

  const [team, setTeam] = useState<CompanyUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!defaultCompanyId) { setLoading(false); return; }
    ApiService.getCompanyUsers(defaultCompanyId)
      .then(c => setTeam(c.users ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [defaultCompanyId]);

  const roleDefs = useMemo(() => {
    const countByRole: Record<string, number> = {};
    team.forEach(m => {
      const r = m.pivot.role || 'member';
      countByRole[r] = (countByRole[r] || 0) + 1;
    });

    return [
      {
        name: 'Owner',
        count: countByRole['owner'] ?? 0,
        countLabel: `${countByRole['owner'] ?? 0} member${(countByRole['owner'] ?? 0) !== 1 ? 's' : ''}`,
        desc: 'Full access to all company settings, billing, and team management.',
        icon: '★',
        iconBg: '#16143A',
        perms: [
          { label: 'Manage workspace', color: '#0E9F6E', icon: '' },
          { label: 'Billing & subscriptions', color: '#0E9F6E', icon: '' },
          { label: 'Invite & remove members', color: '#0E9F6E', icon: '' },
          { label: 'View all trips & data', color: '#0E9F6E', icon: '' },
        ],
      },
      {
        name: 'Admin',
        count: countByRole['admin'] ?? 0,
        countLabel: `${countByRole['admin'] ?? 0} member${(countByRole['admin'] ?? 0) !== 1 ? 's' : ''}`,
        desc: 'Can manage trips, customers, and most settings except billing.',
        icon: '◆',
        iconBg: '#EAF0FF',
        perms: [
          { label: 'Manage trips & customers', color: '#0E9F6E', icon: '' },
          { label: 'View reports', color: '#0E9F6E', icon: '' },
          { label: 'Invite members', color: '#0E9F6E', icon: '' },
        ],
      },
      {
        name: 'Member',
        count: countByRole['member'] ?? 0,
        countLabel: `${countByRole['member'] ?? 0} member${(countByRole['member'] ?? 0) !== 1 ? 's' : ''}`,
        desc: 'Day-to-day trip management and itinerary building.',
        icon: '●',
        iconBg: '#E3F7EF',
        perms: [
          { label: 'Create & edit trips', color: '#0E9F6E', icon: '' },
          { label: 'Build itineraries', color: '#0E9F6E', icon: '' },
          { label: 'Communicate with travelers', color: '#0E9F6E', icon: '' },
        ],
      },
    ];
  }, [team]);

  if (loading) return <div className="settings-section-wide"><p>Loading roles...</p></div>;

  return (
    <div className="settings-section-wide">
      <p className="roles-desc">Roles control what team members can see and do. Assign permissions per role, not per person.</p>
      <div className="roles-grid">
        {roleDefs.map((r, i) => (
          <div key={i} className="card-padded">
            <div className="card-head">
              <div className="icon-box" style={{ background: r.iconBg }}>{r.icon}</div>
              <div>
                <p className="role-name">{r.name}</p>
                <p className="member-count">{r.countLabel}</p>
              </div>
            </div>
            <p className="role-desc">{r.desc}</p>
            <ul className="perm-list">
              {r.perms.map((p, j) => (
                <li key={j} className="perm-item">
                  <span className="perm-icon" style={{ borderColor: p.color, color: p.color }}>✓</span>
                  {p.label}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Channels Section ──────────────────────────────────────────
// WhatsApp is still the frontend-only simulation (AppContext's connectedChannels/connectDirect).
// Gmail, Google Calendar, and Google Meet are all real. Gmail and Calendar share one connected
// Google account per company (see GmailController's docblock on the backend) — GoogleAppCard
// renders either one, reading the same GET /gmail/status response but toggling its own
// app-specific flag (gmail_enabled/calendar_enabled) via the `app` query param on
// connect/disconnect. Google Meet is a further feature toggle on top of Calendar (same OAuth
// scope, no extra consent) — GoogleMeetToggleCard, not a connect/disconnect flow.

// Mock rows — matches ConnectChannelModal/constants/app.ts's per-channel auth/sync copy
// (connectPickList/connectChannelView). Gmail/Calendar/Meet are rendered separately, not from
// this list.
const MOCK_CHANNEL_DEFS = [
  { name: 'WhatsApp Business', label: 'WhatsApp', sub: 'Send quotes and updates', icon: '💬', iconBg: '#E3F7EF' },
];

const GOOGLE_APPS: {
  app: 'gmail' | 'calendar';
  label: string;
  sub: string;
  icon: string;
  iconBg: string;
}[] = [
  { app: 'gmail', label: 'Gmail', sub: 'Read and reply to enquiries from your inbox', icon: '✉️', iconBg: '#FFE9E6' },
  { app: 'calendar', label: 'Google Calendar', sub: 'See upcoming events so Meridian can match calls to a trip', icon: '📅', iconBg: '#EAF0FF' },
];

function GoogleAppCard({ app, label, sub, icon, iconBg, status, onChanged }: {
  app: 'gmail' | 'calendar';
  label: string;
  sub: string;
  icon: string;
  iconBg: string;
  status: GmailStatusResponse | null;
  onChanged: () => void;
}) {
  const { toastAction } = useApp();
  const [busy, setBusy] = useState(false);

  const connected = app === 'gmail' ? !!status?.gmail_enabled : !!status?.calendar_enabled;
  // Once either app is connected, the underlying Google account already exists — connecting the
  // other one is a quick incremental-scope consent, not a full reauthentication (see
  // GmailController::connect()'s `incremental` handling).
  const accountExists = !!status?.connected;

  const handleConnect = async () => {
    setBusy(true);
    try {
      const url = await ApiService.getGmailAuthUrl(app);
      window.location.href = url;
    } catch {
      toastAction(`Could not start ${label} connect — please try again`);
      setBusy(false);
    }
  };

  const handleDisconnect = async () => {
    setBusy(true);
    try {
      await ApiService.disconnectGmail(app);
      toastAction(`${label} disconnected`);
      onChanged();
    } catch {
      toastAction(`Failed to disconnect ${label}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="channel-card">
      <div className="ch-left">
        <div className="ch-icon" style={{ background: iconBg }}>{icon}</div>
        <div className="ch-info">
          <p className="ch-name">{label}</p>
          <p className="ch-sub">
            {connected ? status?.google_email : accountExists ? `Included with your Google connection (${status?.google_email})` : sub}
          </p>
          {connected && <span className="ch-conn">● Connected</span>}
        </div>
      </div>
      {connected ? (
        <button
          className="action-btn"
          style={{ background: '#fff', border: '1px solid #F3B0A6', color: '#C0392B' }}
          onClick={handleDisconnect}
          disabled={busy}
        >
          {busy ? 'Disconnecting…' : 'Disconnect'}
        </button>
      ) : (
        <button
          className="action-btn"
          style={{ background: '#2B63F6', border: '1px solid transparent', color: '#fff' }}
          onClick={handleConnect}
          disabled={busy}
        >
          {busy ? 'Redirecting…' : 'Connect'}
        </button>
      )}
    </div>
  );
}

// Meet call tracking (CalendarWatcherJob + "Schedule with Google Meet") is a feature toggle on
// top of an already-connected Calendar, not its own OAuth connection — so this card calls
// PATCH /gmail/meet-tracking directly instead of a connect/disconnect redirect, and disables
// itself until Calendar is on.
function GoogleMeetToggleCard({ status, onChanged }: {
  status: GmailStatusResponse | null;
  onChanged: () => void;
}) {
  const { toastAction } = useApp();
  const [busy, setBusy] = useState(false);

  const calendarConnected = !!status?.calendar_enabled;
  const enabled = !!status?.meet_tracking_enabled;

  const handleToggle = async () => {
    setBusy(true);
    try {
      await ApiService.updateMeetTracking(!enabled);
      toastAction(enabled ? 'Google Meet tracking turned off' : 'Google Meet tracking turned on');
      onChanged();
    } catch {
      toastAction('Could not update Google Meet — please try again');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="channel-card">
      <div className="ch-left">
        <div className="ch-icon" style={{ background: '#F0EBFF' }}>🎥</div>
        <div className="ch-info">
          <p className="ch-name">Google Meet</p>
          <p className="ch-sub">
            {calendarConnected ? 'Auto-detect and schedule Meet calls for a trip' : 'Connect Google Calendar first to turn this on'}
          </p>
          {enabled && <span className="ch-conn">● Connected</span>}
        </div>
      </div>
      {enabled ? (
        <button
          className="action-btn"
          style={{ background: '#fff', border: '1px solid #F3B0A6', color: '#C0392B' }}
          onClick={handleToggle}
          disabled={busy}
        >
          {busy ? 'Turning off…' : 'Disconnect'}
        </button>
      ) : (
        <button
          className="action-btn"
          style={{
            background: calendarConnected ? '#2B63F6' : '#EEF0F4',
            border: '1px solid transparent',
            color: calendarConnected ? '#fff' : '#AEB3C2',
            cursor: calendarConnected ? 'pointer' : 'not-allowed',
          }}
          onClick={handleToggle}
          disabled={busy || !calendarConnected}
        >
          {busy ? 'Turning on…' : 'Connect'}
        </button>
      )}
    </div>
  );
}

function GoogleAppCards() {
  const { toastAction } = useApp();
  const [searchParams, setSearchParams] = useSearchParams();
  const [status, setStatus] = useState<GmailStatusResponse | null>(null);

  const refreshStatus = useCallback(() => {
    ApiService.getGmailStatus()
      .then(setStatus)
      .catch(() => setStatus({ connected: false }));
  }, []);

  useEffect(() => {
    const gmailParam = searchParams.get('gmail');
    if (gmailParam === 'connected') {
      toastAction('Google account connected');
    } else if (gmailParam === 'error') {
      toastAction('Failed to connect — please try again');
    }
    if (gmailParam) {
      const next = new URLSearchParams(searchParams);
      next.delete('gmail');
      setSearchParams(next, { replace: true });
    }
    refreshStatus();
    // Only meant to run once on mount (plus whenever the ?gmail= redirect param changes) —
    // refreshStatus/toastAction/setSearchParams are stable, searchParams itself isn't a
    // dependency we want re-running this for every unrelated query-param change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      {GOOGLE_APPS.map(a => (
        <GoogleAppCard key={a.app} {...a} status={status} onChanged={refreshStatus} />
      ))}
      <GoogleMeetToggleCard status={status} onChanged={refreshStatus} />
    </>
  );
}

function ChannelsSection() {
  const ctx = useApp();

  return (
    <div className="settings-section">
      <DemoBanner label="Demo feature — WhatsApp connections are not yet wired to a backend (Gmail/Google Meet are real)" />
      <div className="head-row">
        <p className="head-title">Connected channels</p>
        <button className="btn-connect" onClick={ctx.openConnect}>Connect channel</button>
      </div>
      <div className="ch-list">
        <GoogleAppCards />
        {MOCK_CHANNEL_DEFS.map((ch) => {
          const connected = ctx.connectedChannels.includes(ch.name);
          return (
            <div key={ch.name} className="channel-card">
              <div className="ch-left">
                <div className="ch-icon" style={{ background: ch.iconBg }}>{ch.icon}</div>
                <div className="ch-info">
                  <p className="ch-name">{ch.label}</p>
                  <p className="ch-sub">{ch.sub}</p>
                  {connected && <span className="ch-conn">● Connected</span>}
                </div>
              </div>
              {connected ? (
                <button
                  className="action-btn"
                  style={{ background: '#fff', border: '1px solid #F3B0A6', color: '#C0392B' }}
                  onClick={() => ctx.disconnectChannel(ch.name)}
                >
                  Disconnect
                </button>
              ) : (
                <button
                  className="action-btn"
                  style={{ background: '#2B63F6', border: '1px solid transparent', color: '#fff' }}
                  onClick={() => ctx.connectDirect(ch.name)}
                >
                  Connect
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Notifications ─────────────────────────────────────────────
// Local state toggles for notification preferences.

function Notifications() {
  const [settings, setSettings] = useState({
    email_notifs: true,
    sms_notifs: false,
    trip_updates: true,
    marketing: false,
  });

  const notifItems = [
    { key: 'email_notifs' as const, title: 'Email notifications', desc: 'Receive trip updates via email' },
    { key: 'sms_notifs' as const, title: 'SMS notifications', desc: 'Get text messages for urgent updates' },
    { key: 'trip_updates' as const, title: 'Trip updates', desc: 'Daily summary of trip status changes' },
    { key: 'marketing' as const, title: 'Marketing emails', desc: 'Product updates and feature announcements' },
  ];

  const toggle = (key: keyof typeof settings) => {
    setSettings(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="settings-section">
      <DemoBanner label="Demo feature — preferences here aren't saved to your account yet" />
      <div className="notif-list">
        {notifItems.map((n) => {
          const isOn = settings[n.key];
          return (
            <div key={n.key} className="notif-item">
              <div className="text-block">
                <p className="item-title">{n.title}</p>
                <p className="item-desc">{n.desc}</p>
              </div>
              <button className="toggle-track" style={{ background: isOn ? '#2B63F6' : '#DDE0E8' }} onClick={() => toggle(n.key)}>
                <div className="toggle-knob" style={{ left: isOn ? '18px' : '2px' }} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── EditProfile ───────────────────────────────────────────────
// Allows updating the current user's display name and phone via AuthContext.

function EditProfile() {
  const { user, updateProfile } = useAuth();
  const { toastAction } = useApp();
  const [displayName, setDisplayName] = useState(user?.display_name ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDisplayName(user?.display_name ?? '');
    setPhone(user?.phone ?? '');
  }, [user]);

  const initials = (user?.display_name ?? 'U')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase();

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateProfile({ display_name: displayName, phone: phone || null });
      toastAction('Profile updated');
    } catch {
      toastAction('Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="settings-section">
      <div className="profile-avatar-area">
        <div className="profile-avatar-lg">{initials}</div>
        <div>
          <div className="profile-avatar-name">{user?.display_name ?? 'User'}</div>
          <div className="profile-avatar-email">{user?.email ?? ''}</div>
        </div>
      </div>
      <div className="field-row">
        <label className="field-label">Display name</label>
        <input
          className="field-input"
          value={displayName}
          onChange={e => setDisplayName(e.target.value)}
        />
      </div>
      <div className="field-row">
        <label className="field-label">Email</label>
        <input className="field-input" value={user?.email ?? ''} disabled />
      </div>
      <div className="field-row">
        <label className="field-label">Phone</label>
        <input
          className="field-input"
          value={phone}
          onChange={e => setPhone(e.target.value)}
          placeholder="+233 50 000 0000"
        />
      </div>
      <div className="btn-row btn-row-end">
        <button className="btn-cancel" onClick={() => { setDisplayName(user?.display_name ?? ''); setPhone(user?.phone ?? ''); }}>
          Cancel
        </button>
        <button className="btn-save" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  );
}

// ── AI & Models ────────────────────────────────────────────────
// Lets the company select their preferred AI model for itinerary generation.
// Preference is persisted in localStorage under 'meridian_ai_provider' so it
// survives page reloads without requiring a backend settings field.

const AI_PROVIDERS = [
  { id: '',          label: 'Auto (recommended)', sub: 'Uses best available model, falls back automatically', icon: '✦' },
  { id: 'gemini',    label: 'Gemini 2.5 Flash Lite', sub: 'Google — free tier, fast responses',            icon: 'G' },
  { id: 'openai',    label: 'GPT-4o Mini',            sub: 'OpenAI — strong reasoning, reliable output',   icon: 'O' },
  { id: 'anthropic', label: 'Claude Haiku',            sub: 'Anthropic — concise, structured output',      icon: 'A' },
];

export const MERIDIAN_AI_PROVIDER_KEY = 'meridian_ai_provider';

function AiSettings() {
  const [selected, setSelected] = useState<string>(() => localStorage.getItem(MERIDIAN_AI_PROVIDER_KEY) ?? '');

  const handleSelect = (id: string) => {
    setSelected(id);
    localStorage.setItem(MERIDIAN_AI_PROVIDER_KEY, id);
  };

  return (
    <div className="settings-section">
      <div className="field-row">
        <label className="field-label">Default model for itinerary generation</label>
        <p className="field-hint">This model is used whenever you generate trip options. Auto uses Gemini first and falls back to OpenAI or Claude if quota is exceeded.</p>
      </div>
      <div className="ai-model-grid">
        {AI_PROVIDERS.map(p => (
          <button
            key={p.id}
            className={`ai-model-card${selected === p.id ? ' selected' : ''}`}
            onClick={() => handleSelect(p.id)}
          >
            <div className="ai-model-icon">{p.icon}</div>
            <div className="ai-model-info">
              <div className="ai-model-name">{p.label}</div>
              <div className="ai-model-sub">{p.sub}</div>
            </div>
            {selected === p.id && <div className="ai-model-check">✓</div>}
          </button>
        ))}
      </div>
      <p className="field-hint" style={{ marginTop: 16 }}>
        You can also override the model per generation in the "Generate itinerary" modal.
      </p>
    </div>
  );
}

// ── Payment Accounts ──────────────────────────────────────────
// WeWire multi-currency virtual accounts (up to WEWIRE_MAX_ACCOUNTS), each account's
// hold-vs-disburse setting, beneficiary management, and the unmatched-inbound-transfer
// reconciliation queue. Reachable here after onboarding (see PaymentsOnboarding.tsx) and any
// time after, since accounts/beneficiaries can be added or changed at will.

function PaymentAccounts() {
  const { toastAction } = useApp();
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState<VirtualAccountResponse[]>([]);
  const [wallets, setWallets] = useState<WeWireCryptoWalletResponse[]>([]);
  const [beneficiaries, setBeneficiaries] = useState<WeWireBeneficiaryResponse[]>([]);
  const [inbound, setInbound] = useState<WeWireInboundResponse[]>([]);
  const [disbursements, setDisbursements] = useState<WeWireDisbursementResponse[]>([]);
  const [wewireSubcustomerId, setWewireSubcustomerId] = useState<string | null>(null);
  const [wewireKycStatus, setWewireKycStatus] = useState<WeWireKycStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [addingCurrency, setAddingCurrency] = useState('');
  const [requesting, setRequesting] = useState(false);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  // Crypto wallets — "asset/chain" combo string (e.g. "USDC/BASE") since a wallet is keyed by
  // both, not just one dropdown's worth of choice.
  const [addingWalletCombo, setAddingWalletCombo] = useState('');
  const [requestingWallet, setRequestingWallet] = useState(false);

  // Add-beneficiary form (payout account — for the agency itself, or a specific trip service
  // provider like an airline or hotel). Currently the only way to add one from the UI.
  const [showAddBeneficiary, setShowAddBeneficiary] = useState(false);
  const [addingBeneficiary, setAddingBeneficiary] = useState(false);
  const [benType, setBenType] = useState<'agency' | 'provider'>('agency');
  const [benLabel, setBenLabel] = useState('');
  const [benCurrency, setBenCurrency] = useState('USD');
  const [benAccountName, setBenAccountName] = useState('');
  const [benBankName, setBenBankName] = useState('');
  const [benCountry, setBenCountry] = useState('');
  const [benAccountNumber, setBenAccountNumber] = useState('');
  const [benIban, setBenIban] = useState('');
  const [benSettlementMethod, setBenSettlementMethod] = useState('WIRE');
  const [benAddressLine1, setBenAddressLine1] = useState('');
  const [benCity, setBenCity] = useState('');

  const load = () => {
    setLoading(true);
    Promise.all([
      ApiService.getWeWireStatus(),
      ApiService.getWeWireAccounts(),
      ApiService.getWeWireWallets(),
      ApiService.getWeWireBeneficiaries(),
      ApiService.getWeWireInboundQueue('unmatched'),
      ApiService.getWeWireDisbursements(),
    ])
      .then(([status, acc, wal, ben, inb, dis]) => {
        setWewireSubcustomerId(status.wewire_subcustomer_id);
        setWewireKycStatus(status.wewire_kyc_status);
        setAccounts(acc); setWallets(wal); setBeneficiaries(ben); setInbound(inb.data ?? []); setDisbursements(dis.data ?? []);
      })
      .catch(() => toastAction('Failed to load payment accounts'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const availableCurrencies = WEWIRE_SUPPORTED_CURRENCIES.filter(c => !accounts.some(a => a.currency === c));

  // Every (asset, chain) combo the company doesn't already have a wallet for.
  const availableWalletCombos = CRYPTO_WALLET_ASSETS.flatMap(asset =>
    CRYPTO_WALLET_CHAINS
      .filter(chain => !wallets.some(w => w.asset === asset && w.chain === chain))
      .map(chain => `${asset}/${chain}`)
  );

  const handleAddAccount = async () => {
    if (!addingCurrency) return;
    setRequesting(true);
    try {
      await ApiService.createWeWireAccount(addingCurrency);
      toastAction(`${addingCurrency} account requested`);
      setAddingCurrency('');
      load();
    } catch (error) {
      toastAction(error instanceof Error ? error.message : 'Failed to request account');
    } finally {
      setRequesting(false);
    }
  };

  const handleAddWallet = async () => {
    const [asset, chain] = addingWalletCombo.split('/');
    if (!asset || !chain) return;
    setRequestingWallet(true);
    try {
      await ApiService.createWeWireWallet(asset, chain);
      toastAction(`${asset} on ${chain} wallet requested`);
      setAddingWalletCombo('');
      load();
    } catch (error) {
      toastAction(error instanceof Error ? error.message : 'Failed to request wallet');
    } finally {
      setRequestingWallet(false);
    }
  };

  const handleFundHandlingChange = async (account: VirtualAccountResponse, fundHandling: FundHandling) => {
    if (fundHandling === 'disburse' && !account.beneficiary_account_id) {
      const match = beneficiaries.find(b => b.currency === account.currency);
      if (!match) {
        toastAction(`Add a ${account.currency} beneficiary account first`);
        return;
      }
      try {
        await ApiService.updateWeWireAccount(account.id, { fund_handling: fundHandling, beneficiary_account_id: match.id });
        toastAction('Payout setting updated');
        load();
      } catch {
        toastAction('Failed to update payout setting');
      }
      return;
    }
    try {
      await ApiService.updateWeWireAccount(account.id, { fund_handling: fundHandling });
      toastAction('Payout setting updated');
      load();
    } catch {
      toastAction('Failed to update payout setting');
    }
  };

  const handleRetryDisbursement = async (disbursement: WeWireDisbursementResponse) => {
    setRetryingId(disbursement.id);
    try {
      await ApiService.retryWeWireDisbursement(disbursement.id);
      toastAction('Disbursement retried');
      load();
    } catch (error) {
      toastAction(error instanceof Error ? error.message : 'Failed to retry disbursement');
    } finally {
      setRetryingId(null);
    }
  };

  const resetBeneficiaryForm = () => {
    setBenType('agency'); setBenLabel(''); setBenCurrency('USD'); setBenAccountName('');
    setBenBankName(''); setBenCountry(''); setBenAccountNumber(''); setBenIban('');
    setBenSettlementMethod('WIRE'); setBenAddressLine1(''); setBenCity('');
  };

  const handleAddBeneficiary = async () => {
    if (!benAccountName.trim() || !benCountry.trim() || !benAddressLine1.trim() || !benCity.trim()) return;
    setAddingBeneficiary(true);
    try {
      await ApiService.createWeWireBeneficiary({
        beneficiary_type: benType,
        label: benType === 'provider' ? (benLabel.trim() || null) : null,
        currency: benCurrency,
        account_name: benAccountName.trim(),
        bank_name: benBankName.trim() || null,
        country: benCountry.trim().toUpperCase(),
        account_number: benAccountNumber.trim() || null,
        iban: benIban.trim() || null,
        settlement_method: benSettlementMethod,
        address_line1: benAddressLine1.trim(),
        city: benCity.trim(),
      });
      toastAction('Payout account added');
      setShowAddBeneficiary(false);
      resetBeneficiaryForm();
      load();
    } catch (error) {
      toastAction(error instanceof Error ? error.message : 'Failed to add payout account');
    } finally {
      setAddingBeneficiary(false);
    }
  };

  const handleMatchInbound = async (item: WeWireInboundResponse) => {
    const installmentId = window.prompt('Enter the installment ID to match this transfer to:');
    if (!installmentId) return;
    try {
      await ApiService.matchWeWireInbound(item.id, installmentId);
      toastAction('Transfer matched');
      load();
    } catch (error) {
      toastAction(error instanceof Error ? error.message : 'Failed to match transfer');
    }
  };

  if (loading) return <div className="settings-section-wide"><p>Loading payment accounts...</p></div>;

  if (!wewireSubcustomerId) {
    return (
      <div className="settings-section-wide">
        <div style={{
          background: '#FFF8E6', border: '1px solid #F5D98B', borderRadius: 10,
          padding: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
        }}>
          <div>
            <p style={{ fontWeight: 700, margin: '0 0 4px' }}>Complete WeWire business registration</p>
            <p style={{ margin: 0, color: 'var(--text-muted, #5B6172)', fontSize: 14 }}>
              You need to register your business and submit KYC with WeWire before you can request
              currency accounts.
            </p>
          </div>
          <button className="btn-save" onClick={() => navigate('/app/onboarding/payments')} style={{ whiteSpace: 'nowrap' }}>
            Complete registration
          </button>
        </div>
      </div>
    );
  }

  // NOTE: WeWire's real KYC endpoint is currently broken on their end, so KYC submission runs
  // simulated (see WEWIRE_SIMULATE in the backend) and will sit in draft/in_review forever —
  // there's no webhook to ever move it to APPROVED. So this is a quiet status line, not an
  // actionable error/nag like it used to be. Revisit once WeWire's KYC is confirmed working.
  const kycStatusCopy: Record<WeWireKycStatus, string> = {
    not_started: 'Business verification not started yet',
    draft: 'Business verification not yet submitted',
    in_review: 'Business verification in review',
    approved: 'Business verification approved',
    rejected: 'Business verification needs another look — resubmit when ready',
    resubmission: 'WeWire requested more information — resubmit when ready',
  };

  return (
    <div className="settings-section-wide">
      {wewireKycStatus && wewireKycStatus !== 'approved' && (
        <div style={{
          background: '#F7F8FA', border: '1px solid #EEF0F4', borderRadius: 10,
          padding: '10px 16px', marginBottom: 20, fontSize: 13, color: 'var(--text-muted, #5B6172)',
        }}>
          {kycStatusCopy[wewireKycStatus]}
        </div>
      )}

      <div className="head-row">
        <p className="head-title">Currency accounts ({accounts.length}/{WEWIRE_MAX_ACCOUNTS})</p>
      </div>

      <div className="table-card">
        <div className="th-row">
          <span className="th-text">Currency</span>
          <span className="th-text">Status</span>
          <span className="th-text">Account details</span>
          <span className="th-text">Funds</span>
        </div>
        {accounts.length === 0 && <div className="tr"><span className="name-text">No currency accounts yet.</span></div>}
        {accounts.map(a => (
          <div key={a.id} className="tr">
            <span className="name-text">{a.currency}</span>
            <span className="active-text">{a.status}</span>
            <span className="email-text">{a.account_number || a.iban || '— pending provisioning —'}</span>
            <select
              className="field-input"
              value={a.fund_handling}
              onChange={e => handleFundHandlingChange(a, e.target.value as FundHandling)}
              style={{ maxWidth: 160 }}
            >
              <option value="hold">Hold in Meridian</option>
              <option value="disburse">Disburse to beneficiary</option>
            </select>
          </div>
        ))}
      </div>

      {availableCurrencies.length > 0 && accounts.length < WEWIRE_MAX_ACCOUNTS && (
        <div className="invite-row">
          <select className="field-input" value={addingCurrency} onChange={e => setAddingCurrency(e.target.value)}>
            <option value="" disabled>Select a currency</option>
            {availableCurrencies.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <button className="btn-save" onClick={handleAddAccount} disabled={requesting || !addingCurrency}>
            {requesting ? 'Requesting...' : 'Add account'}
          </button>
        </div>
      )}

      <div className="head-row" style={{ marginTop: 32 }}>
        <p className="head-title">Crypto wallets</p>
      </div>
      <p className="field-hint">
        Stablecoin deposit addresses (USDC/USDT) travelers can pay into instead of a bank
        transfer — offered alongside a USD payment link. Unlike a bank transfer, a crypto deposit
        can't be auto-matched to a specific trip (most chains have no reference/memo field), so
        it always lands in the reconciliation queue below for you to assign by hand.
      </p>
      <div className="table-card">
        <div className="th-row">
          <span className="th-text">Asset</span>
          <span className="th-text">Chain</span>
          <span className="th-text">Status</span>
          <span className="th-text">Deposit address</span>
        </div>
        {wallets.length === 0 && <div className="tr"><span className="name-text">No crypto wallets yet.</span></div>}
        {wallets.map(w => (
          <div key={w.id} className="tr">
            <span className="name-text">{w.asset}</span>
            <span className="email-text">{w.chain}</span>
            <span className="active-text">{w.status}</span>
            <span className="email-text">{w.deposit_address || '— pending provisioning —'}</span>
          </div>
        ))}
      </div>
      {availableWalletCombos.length > 0 && (
        <div className="invite-row">
          <select className="field-input" value={addingWalletCombo} onChange={e => setAddingWalletCombo(e.target.value)}>
            <option value="" disabled>Select asset / chain</option>
            {availableWalletCombos.map(combo => <option key={combo} value={combo}>{combo.replace('/', ' on ')}</option>)}
          </select>
          <button className="btn-save" onClick={handleAddWallet} disabled={requestingWallet || !addingWalletCombo}>
            {requestingWallet ? 'Requesting...' : 'Add wallet'}
          </button>
        </div>
      )}

      <div className="head-row" style={{ marginTop: 32 }}>
        <p className="head-title">Payout accounts</p>
        <button className="btn-connect" onClick={() => setShowAddBeneficiary(s => !s)}>
          {showAddBeneficiary ? 'Cancel' : '+ Add payout account'}
        </button>
      </div>
      <p className="field-hint">
        Your agency's own account gets paid trip proceeds you hold on to; a provider account (an airline, hotel, or
        activity vendor) is for paying that specific vendor for a trip — see the Payouts tab on a trip.
      </p>

      {showAddBeneficiary && (
        <div className="table-card" style={{ padding: 16, marginBottom: 16 }}>
          <div className="row-2" style={{ display: 'flex', gap: 12, marginBottom: 10 }}>
            <select className="field-input" value={benType} onChange={e => setBenType(e.target.value as 'agency' | 'provider')}>
              <option value="agency">Agency payout account</option>
              <option value="provider">Service provider account</option>
            </select>
            {benType === 'provider' && (
              <input className="field-input" placeholder="Vendor name (e.g. Emirates Airlines)" value={benLabel} onChange={e => setBenLabel(e.target.value)} />
            )}
          </div>
          <div className="row-2" style={{ display: 'flex', gap: 12, marginBottom: 10 }}>
            <select className="field-input" value={benCurrency} onChange={e => setBenCurrency(e.target.value)}>
              {WEWIRE_SUPPORTED_CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <input className="field-input" placeholder="Account holder name" value={benAccountName} onChange={e => setBenAccountName(e.target.value)} />
          </div>
          <div className="row-2" style={{ display: 'flex', gap: 12, marginBottom: 10 }}>
            <input className="field-input" placeholder="Bank name (optional)" value={benBankName} onChange={e => setBenBankName(e.target.value)} />
            <select className="field-input" value={benSettlementMethod} onChange={e => setBenSettlementMethod(e.target.value)}>
              {['WIRE', 'SEPA', 'FPS', 'CHAPS', 'ACH', 'SWIFT'].map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div className="row-2" style={{ display: 'flex', gap: 12, marginBottom: 10 }}>
            <input className="field-input" placeholder="Account number" value={benAccountNumber} onChange={e => setBenAccountNumber(e.target.value)} />
            <input className="field-input" placeholder="IBAN (optional)" value={benIban} onChange={e => setBenIban(e.target.value)} />
          </div>
          <div className="row-2" style={{ display: 'flex', gap: 12, marginBottom: 10 }}>
            <input className="field-input" placeholder="Country code (e.g. GHA)" value={benCountry} onChange={e => setBenCountry(e.target.value.toUpperCase())} maxLength={3} />
            <input className="field-input" placeholder="City" value={benCity} onChange={e => setBenCity(e.target.value)} />
          </div>
          <input className="field-input" placeholder="Address line 1" value={benAddressLine1} onChange={e => setBenAddressLine1(e.target.value)} style={{ marginBottom: 10 }} />
          <button className="btn-save" onClick={handleAddBeneficiary} disabled={addingBeneficiary}>
            {addingBeneficiary ? 'Adding...' : 'Add payout account'}
          </button>
        </div>
      )}

      <div className="table-card">
        <div className="th-row">
          <span className="th-text">Name</span>
          <span className="th-text">Type</span>
          <span className="th-text">Currency</span>
          <span className="th-text">Bank</span>
        </div>
        {beneficiaries.length === 0 && <div className="tr"><span className="name-text">No payout accounts added yet.</span></div>}
        {beneficiaries.map(b => (
          <div key={b.id} className="tr">
            <span className="name-text">{b.label || b.account_name}</span>
            <span className="active-text">{b.beneficiary_type === 'provider' ? 'Provider' : 'Agency'}</span>
            <span className="active-text">{b.currency}</span>
            <span className="email-text">{b.bank_name || b.iban || b.account_number}</span>
          </div>
        ))}
      </div>

      {disbursements.length > 0 && (
        <>
          <div className="head-row" style={{ marginTop: 32 }}>
            <p className="head-title">Disbursements</p>
          </div>
          <div className="table-card">
            <div className="th-row">
              <span className="th-text">Initiated</span>
              <span className="th-text">Amount</span>
              <span className="th-text">For</span>
              <span className="th-text">Beneficiary</span>
              <span className="th-text">Status</span>
              <span className="th-text"></span>
            </div>
            {disbursements.map(d => {
              const retryable = ['initiation_failed', 'failed', 'reversed', 'cancelled'].includes(d.status);
              return (
                <div key={d.id} className="tr">
                  <span className="active-text">{new Date(d.initiated_at).toLocaleString()}</span>
                  <span className="name-text">{d.amount} {d.currency}</span>
                  <span className="email-text">
                    {d.line_item_label ? `${d.source_trip?.trip_name ?? ''} — ${d.line_item_label}` : d.source_trip ? d.source_trip.trip_name : 'Auto (single payment)'}
                  </span>
                  <span className="email-text">{d.beneficiary?.account_name ?? '—'}</span>
                  <span className="active-text" style={{ color: d.status === 'successful' ? '#0E9F6E' : ['failed', 'initiation_failed', 'reversed'].includes(d.status) ? '#F04438' : undefined }}>
                    {d.status.replace('_', ' ')}
                  </span>
                  {retryable ? (
                    <button className="btn-save" onClick={() => handleRetryDisbursement(d)} disabled={retryingId === d.id}>
                      {retryingId === d.id ? 'Retrying...' : 'Retry'}
                    </button>
                  ) : <span />}
                </div>
              );
            })}
          </div>
        </>
      )}

      {inbound.length > 0 && (
        <>
          <div className="head-row" style={{ marginTop: 32 }}>
            <p className="head-title">Unmatched transfers ({inbound.length})</p>
          </div>
          <p className="field-hint">
            These WeWire transfers arrived without a recognizable reference code and need to be matched to a trip's installment manually.
          </p>
          <div className="table-card">
            <div className="th-row">
              <span className="th-text">Received</span>
              <span className="th-text">Amount</span>
              <span className="th-text">Quoted reference</span>
              <span className="th-text"></span>
            </div>
            {inbound.map(item => (
              <div key={item.id} className="tr">
                <span className="active-text">{new Date(item.received_at).toLocaleString()}</span>
                <span className="name-text">{item.amount} {item.currency}</span>
                <span className="email-text">{item.reference_raw || '—'}</span>
                <button className="btn-save" onClick={() => handleMatchInbound(item)}>Match</button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── Settings (main) ────────────────────────────────────────────

export default function Settings() {
  const { tab } = useParams<{ tab: string }>();
  const currentTab: SettingsTab = (tab as SettingsTab) || 'profile';

  return (
    <div className="settings-page">
      <TabBar currentTab={currentTab} />
      <div className="settings-content">
        {currentTab === 'profile' && <EditProfile />}
        {currentTab === 'workspace' && <Workspace />}
        {currentTab === 'team' && <TeamAndSeats />}
        {currentTab === 'roles' && <Roles />}
        {currentTab === 'channels' && <ChannelsSection />}
        {currentTab === 'notifications' && <Notifications />}
        {currentTab === 'ai' && <AiSettings />}
        {currentTab === 'payments' && <PaymentAccounts />}
      </div>
    </div>
  );
}
