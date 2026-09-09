import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApp } from '../contexts/AppContext'
import { useAuth } from '../contexts/AuthContext'
import { ApiService } from '../services/api-service'
import type { SettingsTab, CompanyResponse, CompanyUser, VirtualAccountResponse, WeWireBeneficiaryResponse, WeWireInboundResponse, WeWireDisbursementResponse, FundHandling, WeWireKycStatus } from '../types/app'
import { WEWIRE_SUPPORTED_CURRENCIES, WEWIRE_MAX_ACCOUNTS } from '../types/app'
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
// Placeholder UI for connected communication channels.
// Uses AppContext openConnect flow for the connect modal.

function ChannelsSection() {
  const ctx = useApp();

  // Static channel list — no dedicated backend API yet.
  const channels = [
    { name: 'Email', sub: 'Connect your business email', icon: '@', iconBg: '#EAF0FF', connected: false, btnLabel: 'Connect', btnBg: '#2B63F6', btnBorder: 'transparent', btnFg: '#fff', action: ctx.openConnect },
    { name: 'WhatsApp', sub: 'Send quotes and updates', icon: 'WA', iconBg: '#E3F7EF', connected: false, btnLabel: 'Connect', btnBg: '#2B63F6', btnBorder: 'transparent', btnFg: '#fff', action: ctx.openConnect },
    { name: 'SMS', sub: 'Text message notifications', icon: '✉', iconBg: '#FFF3E0', connected: false, btnLabel: 'Connect', btnBg: '#2B63F6', btnBorder: 'transparent', btnFg: '#fff', action: ctx.openConnect },
    { name: 'Slack', sub: 'Team notifications & alerts', icon: 'S', iconBg: '#EEF0F4', connected: false, btnLabel: 'Connect', btnBg: '#2B63F6', btnBorder: 'transparent', btnFg: '#fff', action: ctx.openConnect },
  ];

  return (
    <div className="settings-section">
      <DemoBanner label="Demo feature — channel connections are not yet wired to a backend" />
      <div className="head-row">
        <p className="head-title">Connected channels</p>
        <button className="btn-connect" onClick={ctx.openConnect}>Connect channel</button>
      </div>
      <div className="ch-list">
        {channels.map((ch, i) => (
          <div key={i} className="channel-card">
            <div className="ch-left">
              <div className="ch-icon" style={{ background: ch.iconBg }}>{ch.icon}</div>
              <div className="ch-info">
                <p className="ch-name">{ch.name}</p>
                <p className="ch-sub">{ch.sub}</p>
                {ch.connected && <span className="ch-conn">● Connected</span>}
              </div>
            </div>
            <button className="action-btn" style={{ background: ch.btnBg, border: `1px solid ${ch.btnBorder}`, color: ch.btnFg }} onClick={ch.action}>
              {ch.btnLabel}
            </button>
          </div>
        ))}
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
  const [beneficiaries, setBeneficiaries] = useState<WeWireBeneficiaryResponse[]>([]);
  const [inbound, setInbound] = useState<WeWireInboundResponse[]>([]);
  const [disbursements, setDisbursements] = useState<WeWireDisbursementResponse[]>([]);
  const [wewireSubcustomerId, setWewireSubcustomerId] = useState<string | null>(null);
  const [wewireKycStatus, setWewireKycStatus] = useState<WeWireKycStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [addingCurrency, setAddingCurrency] = useState('');
  const [requesting, setRequesting] = useState(false);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    Promise.all([
      ApiService.getWeWireStatus(),
      ApiService.getWeWireAccounts(),
      ApiService.getWeWireBeneficiaries(),
      ApiService.getWeWireInboundQueue('unmatched'),
      ApiService.getWeWireDisbursements(),
    ])
      .then(([status, acc, ben, inb, dis]) => {
        setWewireSubcustomerId(status.wewire_subcustomer_id);
        setWewireKycStatus(status.wewire_kyc_status);
        setAccounts(acc); setBeneficiaries(ben); setInbound(inb.data ?? []); setDisbursements(dis.data ?? []);
      })
      .catch(() => toastAction('Failed to load payment accounts'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const availableCurrencies = WEWIRE_SUPPORTED_CURRENCIES.filter(c => !accounts.some(a => a.currency === c));

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

  const kycNeedsAction = wewireKycStatus === 'not_started' || wewireKycStatus === 'draft' || wewireKycStatus === 'rejected' || wewireKycStatus === 'resubmission';
  const kycStatusCopy: Record<WeWireKycStatus, string> = {
    not_started: 'Business KYC not started',
    draft: 'Business KYC not yet submitted',
    in_review: 'Business KYC is in review with WeWire',
    approved: 'Business KYC approved',
    rejected: 'Business KYC was rejected — resubmit to continue',
    resubmission: 'WeWire requested more information — resubmit to continue',
  };

  return (
    <div className="settings-section-wide">
      {wewireKycStatus && wewireKycStatus !== 'approved' && (
        <div style={{
          background: kycNeedsAction ? '#FFF8E6' : '#EAF2FF',
          border: `1px solid ${kycNeedsAction ? '#F5D98B' : '#BBD4FA'}`,
          borderRadius: 10, padding: 16, marginBottom: 20,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
        }}>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{kycStatusCopy[wewireKycStatus]}</p>
          {kycNeedsAction && (
            <button className="btn-save" onClick={() => navigate('/app/onboarding/payments')} style={{ whiteSpace: 'nowrap' }}>
              Continue KYC
            </button>
          )}
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
        <p className="head-title">Beneficiary accounts</p>
      </div>
      <div className="table-card">
        <div className="th-row">
          <span className="th-text">Name</span>
          <span className="th-text">Currency</span>
          <span className="th-text">Bank</span>
        </div>
        {beneficiaries.length === 0 && <div className="tr"><span className="name-text">No beneficiary accounts added yet.</span></div>}
        {beneficiaries.map(b => (
          <div key={b.id} className="tr">
            <span className="name-text">{b.account_name}</span>
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
                  <span className="email-text">{d.source_trip ? d.source_trip.trip_name : 'Auto (single payment)'}</span>
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
