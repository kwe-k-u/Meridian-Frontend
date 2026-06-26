import { useParams, useNavigate } from 'react-router-dom';
import { useApp } from '../contexts/AppContext'
import type { SettingsTab } from '../types/app'
import '../styles/Settings.css'

function TabBar({ currentTab }: { currentTab: SettingsTab }) {
  const navigate = useNavigate();
  const ctx = useApp()
  const settingsTabs = ctx.getSettingsTabs()

  return (
    <div className="tab-bar">
      {settingsTabs.map((t) => (
        <button key={t.key} className={`tab-btn${currentTab === t.key ? ' active' : ''}`} onClick={() => navigate('/app/settings/' + t.key)}>
          {t.label}
        </button>
      ))}
    </div>
  )
}

function Workspace() {
  return (
    <div className="settings-section">
      <div className="logo-area">Upload logo</div>
      <div className="field-row">
        <label className="field-label">Company name</label>
        <input className="field-input" defaultValue="Oasis Travel Agency" />
      </div>
      <div className="field-row">
        <label className="field-label">Company URL</label>
        <input className="field-input" defaultValue="oasistravel.com" />
      </div>
      <div className="row-2">
        <div className="field-row">
          <label className="field-label">Region</label>
          <select className="field-select" defaultValue="Africa">
            <option>Africa</option>
            <option>Europe</option>
            <option>Asia</option>
            <option>Americas</option>
          </select>
        </div>
        <div className="field-row">
          <label className="field-label">Currency</label>
          <select className="field-select" defaultValue="GHS">
            <option>GHS</option>
            <option>USD</option>
            <option>EUR</option>
            <option>GBP</option>
          </select>
        </div>
      </div>
      <div className="row-2">
        <div className="field-row">
          <label className="field-label">Timezone</label>
          <select className="field-select" defaultValue="Africa/Accra">
            <option>Africa/Accra</option>
            <option>Europe/London</option>
            <option>America/New_York</option>
          </select>
        </div>
        <div className="field-row">
          <label className="field-label">Language</label>
          <select className="field-select" defaultValue="English">
            <option>English</option>
            <option>French</option>
            <option>Spanish</option>
          </select>
        </div>
      </div>
      <div className="btn-row btn-row-end">
        <button className="btn-cancel">Cancel</button>
        <button className="btn-save">Save</button>
      </div>
    </div>
  )
}

function TeamAndSeats() {
  const ctx = useApp()
  const { team, seatsUsed, seatsTotal } = ctx.getTeamData()

  return (
    <div className="settings-section-wide">
      <div className="seat-section">
        <p className="seat-label">Seat usage</p>
        <div className="bar-outer"><div className="bar-inner" style={{ width: `${(seatsUsed / seatsTotal) * 100}%` }} /></div>
        <p className="seat-meta">{seatsUsed} of {seatsTotal} seats used</p>
        <div className="btn-row">
          <button className="btn-outline-settings" onClick={ctx.addSeats}>Add seats</button>
          <button className="btn-outline-settings">Compare plans</button>
        </div>
      </div>
      <div className="table-card">
        <div className="th-row">
          <span className="th-text">Member</span>
          <span className="th-text">Role</span>
          <span className="th-text">Last active</span>
          <span className="th-text"></span>
        </div>
        {team.map((m, i) => (
          <div key={i} className="tr">
            <div className="avatar-row">
              <div className="avatar-circle-sm" style={{ background: m.avatarBg }}>{m.initials}</div>
              <div className="name-block">
                <p className="name-text">{m.name} {m.you && <span className="you-label">(you)</span>}</p>
                <p className="email-text">{m.email}</p>
              </div>
            </div>
            <span className="role-pill" style={{ background: m.roleBg, color: m.roleFg }}>{m.role}</span>
            <span className="active-text">{m.active}</span>
            <button className="menu-btn" onClick={m.menu}>⋯</button>
          </div>
        ))}
      </div>
      <button className="invite-btn" onClick={ctx.inviteTeammate}>Invite teammate</button>
    </div>
  )
}

function Roles() {
  const ctx = useApp()
  const { roles } = ctx.getTeamData()

  return (
    <div className="settings-section-wide">
      <p className="roles-desc">Roles control what team members can see and do. Assign permissions per role, not per person.</p>
      <div className="roles-grid">
        {roles.map((r, i) => (
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
                  <span className="perm-icon" style={{ borderColor: p.color, color: p.color }}>{p.icon === 'M20 6 9 17l-5-5' ? '✓' : '✗'}</span>
                  {p.label}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}

function ChannelsSection() {
  const ctx = useApp()
  const { channels } = ctx.getTeamData()

  return (
    <div className="settings-section">
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
  )
}

function Notifications() {
  const ctx = useApp()
  const { notifSettings } = ctx.getTeamData()

  return (
    <div className="settings-section">
      <div className="notif-list">
        {notifSettings.map((n, i) => (
          <div key={i} className="notif-item">
            <div className="text-block">
              <p className="item-title">{n.title}</p>
              <p className="item-desc">{n.desc}</p>
            </div>
            <button className="toggle-track" style={{ background: n.trackBg }} onClick={n.toggle}>
              <div className="toggle-knob" style={{ left: n.knobX }} />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Settings() {
  const { tab } = useParams<{ tab: string }>();
  const currentTab: SettingsTab = (tab as SettingsTab) || 'team';

  return (
    <div className="settings-page">
      <TabBar currentTab={currentTab} />
      <div className="settings-content">
        {currentTab === 'workspace' && <Workspace />}
        {currentTab === 'team' && <TeamAndSeats />}
        {currentTab === 'roles' && <Roles />}
        {currentTab === 'channels' && <ChannelsSection />}
        {currentTab === 'notifications' && <Notifications />}
      </div>
    </div>
  )
}
