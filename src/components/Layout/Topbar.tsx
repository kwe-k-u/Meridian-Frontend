import React from 'react';
import { useLocation } from 'react-router-dom';
import { useApp } from '../../contexts/AppContext';
import '../../styles/Topbar.css';

function usePageInfo() {
  const loc = useLocation();
  const path = loc.pathname;

  if (path.startsWith('/app/dashboard')) return ['Dashboard', 'Your agency at a glance'];
  if (path.startsWith('/app/trips')) {
    if (path === '/app/trips') return ['Trips', 'All trips and enquiries'];
    return ['Trip detail', ''];
  }
  if (path.startsWith('/app/messages')) return ['Messages', 'Unified inbox'];
  if (path.startsWith('/app/travelers')) return ['Travelers', 'Your travelers'];
  if (path.startsWith('/app/financials')) return ['Financials', 'Revenue, invoices & payouts'];
  if (path.startsWith('/app/pricing')) return ['Pricing', 'Choose your plan'];
  if (path.startsWith('/app/settings')) return ['Settings', 'Manage your workspace'];
  if (path.startsWith('/app/help')) {
    if (path === '/app/help') return ['Help & guides', 'How Meridian works'];
    return ['Guide', ''];
  }
  return ['', ''];
}

export default function Topbar() {
  const [pageTitle, pageSub] = usePageInfo();
  const { openCreate, openGenItin, toastAction } = useApp();

  return (
    <div className="topbar">
      <div className="topbar-title">
        <div className="topbar-title-text">
          {pageTitle}
        </div>
        <div className="topbar-title-sub">
          {pageSub}
        </div>
      </div>

      <div className="topbar-search">
        <div className="topbar-search-wrap">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8A90A2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            placeholder="Search trips, travelers…"
            className="topbar-search-input"
          />
        </div>
      </div>

      <div className="topbar-actions">
        <button
          onClick={openGenItin}
          className="btn-primary"
          style={{ background: '#10B981', borderColor: '#10B981', marginRight: 8 }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
          </svg>
          Generate itinerary
        </button>
        <button
          onClick={openCreate}
          className="btn-primary"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          New trip
        </button>

        <div
          onClick={() => toastAction('No new notifications')}
          className="topbar-notif"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#5B6172" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
          <div className="topbar-notif-dot" />
        </div>
      </div>
    </div>
  );
}
