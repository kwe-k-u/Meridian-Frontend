import { createContext, useContext, useEffect, useState, useCallback, useMemo, type ReactNode } from 'react';
import { ApiService } from '../services/api-service';
import { useAuth } from './AuthContext';

// ── CurrencyContext ─────────────────────────────────────────────
// Purpose: Converts and formats money amounts into the caller's company's preferred currency
// (Settings > Workspace), using the hardcoded rate table served by GET /currency-rates (see
// CurrencyService on the backend). Amounts themselves are never mutated anywhere — every
// screen still stores/sends whatever currency it always did (GHS by default); this only
// controls what's shown on screen.
// State: rates (fetched at most once per browser session — see RATES_CACHE_KEY below),
// preferredCurrency (derived from the auth user's default company).
// API: ApiService.getCurrencyRates.

// Rates are hardcoded server-side (they don't move within a session), so there's no reason to
// re-fetch them on every reload — cache in sessionStorage (cleared when the tab/browser closes,
// unlike localStorage) and only hit the API once per session, the first time they're needed.
const RATES_CACHE_KEY = 'meridian_currency_rates';

function readCachedRates(): Record<string, number> | null {
  try {
    const cached = sessionStorage.getItem(RATES_CACHE_KEY);
    return cached ? JSON.parse(cached) : null;
  } catch {
    return null;
  }
}

interface CurrencyContextType {
  preferredCurrency: string;
  ratesLoaded: boolean;
  // Converts `amount` (in `from` currency) into `to` (defaults to the preferred currency).
  convert: (amount: number, from: string, to?: string) => number;
  // Converts + formats as "CODE 1,234.56" (the same shape every fmtCurrency-style helper in
  // this codebase already used, just no longer hardcoded to GHS).
  format: (amount: number, from?: string) => string;
}

const CurrencyContext = createContext<CurrencyContextType | null>(null);

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [rates, setRates] = useState<Record<string, number> | null>(readCachedRates);

  useEffect(() => {
    if (rates) return; // already have this session's cached rates, no need to re-fetch
    ApiService.getCurrencyRates()
      .then(res => {
        setRates(res.rates);
        try { sessionStorage.setItem(RATES_CACHE_KEY, JSON.stringify(res.rates)); } catch {}
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Same "default company" lookup used throughout Settings.tsx/Sidebar.tsx/etc.
  const preferredCurrency = useMemo(() => {
    const def = user?.companies?.find(c => c.pivot.is_default) ?? user?.companies?.[0];
    return def?.preferred_currency ?? 'GHS';
  }, [user]);

  const convert = useCallback((amount: number, from: string, to?: string): number => {
    const target = to ?? preferredCurrency;
    if (!rates || from === target) return amount;
    const fromRate = rates[from] ?? 1;
    const toRate = rates[target] ?? 1;
    return Math.round((amount * fromRate / toRate) * 100) / 100;
  }, [rates, preferredCurrency]);

  const format = useCallback((amount: number, from = 'GHS'): string => {
    const target = rates ? preferredCurrency : from;
    const converted = convert(amount, from, target);
    return `${target} ${converted.toLocaleString('en-US')}`;
  }, [convert, preferredCurrency, rates]);

  const ctx = useMemo<CurrencyContextType>(() => ({
    preferredCurrency,
    ratesLoaded: rates !== null,
    convert,
    format,
  }), [preferredCurrency, rates, convert, format]);

  return (
    <CurrencyContext.Provider value={ctx}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency(): CurrencyContextType {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error('useCurrency() must be used within a CurrencyProvider');
  return ctx;
}
