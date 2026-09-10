// ── WeWire fallback confirmation ────────────────────────────────
// When a live WeWire API call fails, the backend doesn't just error out — it proposes a
// simulated result instead (see WeWireService::liveCall on the backend) and returns it as a
// 409 with `requires_confirmation: true`. This module is the bridge between that response and
// the "Response from wewire server" popup (WeWireFallbackModal.tsx): api-service.ts calls
// confirmWeWireFallback() when it sees that shape, the modal (subscribed via
// subscribeWeWireFallback) renders the popup and waits for the user, and
// answerWeWireFallback() resolves the promise api-service.ts is awaiting so it knows whether to
// resubmit the original request with confirm_simulated: true.

export interface WeWireFallbackPayload {
  title: string;
  message: string;
  error?: { status: number | null; body: unknown } | null;
  simulated?: Record<string, unknown> | null;
}

type Listener = (payload: WeWireFallbackPayload | null) => void;

let listener: Listener | null = null;
let resolver: ((accepted: boolean) => void) | null = null;

export function subscribeWeWireFallback(fn: Listener): () => void {
  listener = fn;
  return () => {
    if (listener === fn) listener = null;
  };
}

// Shows the popup and resolves once the user accepts (proceed with simulated result) or
// declines (cancel — leave the action failed). Only one fallback prompt is shown at a time;
// a second call while one is pending replaces it.
export function confirmWeWireFallback(payload: WeWireFallbackPayload): Promise<boolean> {
  return new Promise((resolve) => {
    resolver = (accepted: boolean) => {
      resolver = null;
      listener?.(null);
      resolve(accepted);
    };
    listener?.(payload);
  });
}

export function answerWeWireFallback(accepted: boolean): void {
  resolver?.(accepted);
}

// Narrows an axios error response body down to the fallback payload shape, or null if this
// isn't one of ours (a plain validation/auth error, etc).
export function extractWeWireFallback(data: unknown): WeWireFallbackPayload | null {
  if (!data || typeof data !== 'object') return null;
  const body = data as Record<string, unknown>;
  if (body.requires_confirmation !== true) return null;
  return {
    title: typeof body.title === 'string' ? body.title : 'Response from wewire server',
    message: typeof body.message === 'string' ? body.message : 'WeWire did not accept this request.',
    error: (body.error as WeWireFallbackPayload['error']) ?? null,
    simulated: (body.simulated as WeWireFallbackPayload['simulated']) ?? null,
  };
}
