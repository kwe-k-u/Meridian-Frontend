// ── ISO Country Codes ────────────────────────────────────────
// WeWire's API expects ISO 3166-1 alpha-3 country codes (e.g. "GHA", not "Ghana") for
// sub-customer/beneficiary registration — see PaymentsOnboarding.tsx and the "Payments" tab
// in Settings.tsx. A curated list covering Meridian's most common markets, rather than the
// full 195-country set `constants/auth.ts` uses for the (display-only) signup country field.

export const isoCountries: { name: string; code: string }[] = [
  { name: 'Ghana', code: 'GHA' },
  { name: 'Nigeria', code: 'NGA' },
  { name: 'Kenya', code: 'KEN' },
  { name: 'South Africa', code: 'ZAF' },
  { name: 'Tanzania', code: 'TZA' },
  { name: 'Uganda', code: 'UGA' },
  { name: 'Rwanda', code: 'RWA' },
  { name: 'Ivory Coast', code: 'CIV' },
  { name: 'Senegal', code: 'SEN' },
  { name: 'Egypt', code: 'EGY' },
  { name: 'Morocco', code: 'MAR' },
  { name: 'United Kingdom', code: 'GBR' },
  { name: 'United States', code: 'USA' },
  { name: 'Canada', code: 'CAN' },
  { name: 'Germany', code: 'DEU' },
  { name: 'France', code: 'FRA' },
  { name: 'United Arab Emirates', code: 'ARE' },
  { name: 'India', code: 'IND' },
];
