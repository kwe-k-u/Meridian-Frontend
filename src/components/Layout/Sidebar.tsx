import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import logoM from '../../assets/logo/logo_m.svg';
import '../../styles/Sidebar.css';

const navItems = [
  { label: 'Dashboard', icon: 'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z', path: '/app/dashboard' },
  { label: 'Trips', icon: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z', path: '/app/trips' },
  { label: 'Messages', icon: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z', path: '/app/messages', badge: '12' },
  { label: 'Travelers', icon: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm7 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8z', path: '/app/travelers' },
  { label: 'Financials', icon: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0zM12 6v12M18 12H6', path: '/app/financials' },
];

const bottomItems = [
  { label: 'Settings', icon: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm5-3a5 5 0 0 1-2.4 4.2l.35 4.28M9.05 20.48l.35-4.28A5 5 0 0 1 7 12a5 5 0 0 1 2.4-4.2l-.35-4.28M14.95 3.52l-.35 4.28A5 5 0 0 1 17 12', path: '/app/settings' },
  { label: 'Plans & billing', icon: 'M7 7h10v2l-2 3h2l-3 5h-2l-2-4-2 3H6l3-5H7V7z', path: '/app/pricing' },
];

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path: string) => {
    if (path === '/app/dashboard') return location.pathname === '/app/dashboard';
    return location.pathname.startsWith(path);
  };

  return (
    <div className="sidebar">
      <div className="sidebar-top">
        <div className="sidebar-logo-row">
          <img src={logoM} alt="Meridian" className="sidebar-logo-img" />
          <span className="sidebar-brand">Meridian</span>
        </div>

        <nav className="sidebar-nav">
          {navItems.map(item => {
            const active = isActive(item.path);
            return (
              <div
                key={item.label}
                onClick={() => navigate(item.path)}
                className={`nav-item${active ? ' active' : ''}`}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d={item.icon}/>
                </svg>
                <span className="nav-item-label">{item.label}</span>
                {item.badge && (
                  <span className="nav-badge">
                    {item.badge}
                  </span>
                )}
              </div>
            );
          })}
        </nav>
      </div>

      <div className="sidebar-spacer" />

      <div className="sidebar-bottom">
        {bottomItems.map(item => (
          <div
            key={item.label}
            onClick={() => navigate(item.path)}
            className="bottom-item"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d={item.icon}/>
            </svg>
            <span>{item.label}</span>
          </div>
        ))}
      </div>

      <div className="sidebar-profile">
        <div className="profile-avatar">
          KA
        </div>
        <div className="profile-info">
          <div className="profile-name">Kweku Ansah</div>
          <div className="profile-role">
            Super admin · Oasis Travel
          </div>
        </div>
        <svg className="profile-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      </div>
    </div>
  );
}
