import { useEffect, useState } from 'react';
import { subscribeWeWireFallback, answerWeWireFallback, type WeWireFallbackPayload } from '../../services/wewire-fallback';
import '../../styles/WeWireFallbackModal.css';

// ── WeWireFallbackModal ──────────────────────────────────────
// Purpose: App-wide popup shown whenever a live WeWire API call fails (account creation,
// payouts). Titled "Response from wewire server" per the backend's payload — lets the user
// either proceed with a simulated result (as if that was what WeWire actually returned) or
// cancel and leave the action failed. Mounted once at the app root (see App.tsx); driven by
// src/services/wewire-fallback.ts rather than local props, since the failure can originate from
// any page that calls a WeWire-backed endpoint.
export default function WeWireFallbackModal() {
  const [payload, setPayload] = useState<WeWireFallbackPayload | null>(null);

  useEffect(() => subscribeWeWireFallback(setPayload), []);

  if (!payload) return null;

  const errorBody = payload.error?.body;
  const errorDetail = typeof errorBody === 'string' ? errorBody : errorBody ? JSON.stringify(errorBody) : 'No response body.';

  return (
    <div className="wwf-overlay">
      <div className="wwf-modal" role="dialog" aria-modal="true" aria-labelledby="wwf-title">
        <h2 className="wwf-title" id="wwf-title">{payload.title}</h2>
        <p className="wwf-message">{payload.message}</p>

        <details className="wwf-details">
          <summary>What WeWire actually said</summary>
          <pre className="wwf-error-body">
            {payload.error?.status ? `HTTP ${payload.error.status}\n` : ''}
            {errorDetail}
          </pre>
        </details>

        <div className="wwf-actions">
          <button type="button" className="wwf-btn wwf-btn--cancel" onClick={() => answerWeWireFallback(false)}>
            Cancel
          </button>
          <button type="button" className="wwf-btn wwf-btn--confirm" onClick={() => answerWeWireFallback(true)}>
            Proceed with simulated result
          </button>
        </div>
      </div>
    </div>
  );
}
