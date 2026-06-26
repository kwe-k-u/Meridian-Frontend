import React from 'react';
import { useApp } from '../contexts/AppContext';
import '../styles/Toast.css';

export default function Toast() {
  const { toast } = useApp();

  if (!toast) return null;

  return (
    <div className="toast-wrapper">
      <style>{`
        @keyframes mrise {
          from { opacity: 0; transform: translateX(-50%) translateY(16px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>
      <div className="toast-inner">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#13B981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <polyline points="16 8 10 16 7 13"/>
        </svg>
        {toast}
      </div>
    </div>
  );
}
